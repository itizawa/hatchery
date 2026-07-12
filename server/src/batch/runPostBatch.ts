import {
  GenerationOutputSchema,
  generateSlotKey,
  selectCommunityWorkers,
  selectRotatedWorkers,
  validateGenerationOutput,
  type WorkerState,
} from "@hatchery/common";

import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRecord, CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRecord, PostRepository } from "../persistence/postRepository.js";
import type { TokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import type { WorldStateRepository } from "../persistence/worldStateRepository.js";
import {
  generateConversationWithClaude,
  type ConversationGenerator,
} from "./aiMessageGenerator.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";
import { buildPostPrompt } from "./buildPostPrompt.js";
import { detectSimilarRecentPost } from "./detectDuplicatePostText.js";
import { fetchExternalFeed, type FeedArticle } from "./fetchExternalFeed.js";
import { fetchRecentContext } from "./fetchRecentContext.js";
import { pickInRange } from "./generateCountHints.js";
import { extractErrorMessage, logBatchError, logBatchInfo } from "./logger.js";
import { assignDripTimestamps } from "./assignDripTimestamps.js";
import { withGenerationRetry, RetryableGenerationError } from "./withGenerationRetry.js";

/** 1 定時あたりの post 最小件数（#672）。 */
export const POST_COUNT_MIN = 1;

/** 1 定時あたりの post 最大件数（#672）。コミュニティごとに必ず 1 件のみ生成する。 */
export const POST_COUNT_MAX = 1;

/**
 * post バッチのデフォルトドリップ窓（ms）（#672）。
 * 1 日 1 回起動を想定し 24h 内に post の createdAt を散らす。
 */
export const DEFAULT_POST_DRIP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** プロンプトに載せる直近 post/comment の既定件数。 */
const DEFAULT_RECENT_LIMIT = 30;

/** post バッチの実行結果。 */
export interface RunPostBatchResult {
  posts: PostRecord[];
}

/** 外部フィード取得関数の型（#491 / #1104 / ADR-0035）。テストでモック注入するため deps 経由で渡す。 */
export type FetchFeed = (params: { feedUrl: string }) => Promise<readonly FeedArticle[]>;

/** post バッチの依存インターフェース（テスト用注入対応）。 */
export interface RunPostBatchDeps {
  communityRepo: CommunityRepository;
  postRepo: PostRepository;
  /**
   * コメントリポジトリ（省略可）。
   * post バッチはコメントを書き込まないが、インターフェース整合のため保持する。
   */
  commentRepo?: CommentRepository;
  workerCommunityRepo: WorkerCommunityRepository;
  botWorkerProvider?: () => Promise<readonly WorkerRecord[]>;
  batchRunLogRepository?: BatchRunLogRepository;
  tokenUsageLogRepository?: TokenUsageLogRepository;
  worldStateRepository?: WorldStateRepository;
  appearingWorkerCount?: number;
  generate?: ConversationGenerator;
  /**
   * 外部フィード取得関数（#491 / #1104 / ADR-0035）。省略時は {@link fetchExternalFeed}。
   * community.feedUrl が設定されている場合にのみ呼び出す。
   */
  fetchFeed?: FetchFeed;
  recentLimit?: number;
  slotKey?: string;
  anthropicApiKey?: string;
  rng?: () => number;
  now?: Date;
  postRange?: { min: number; max: number };
  dripWindowMs?: number;
}

/** 1 コミュニティの処理結果（内部型）。 */
interface CommunityPostResult {
  posts: PostRecord[];
  appearedWorkerIds: Set<string>;
}

/** 1 コミュニティ分の post を生成・永続化する（#672）。失敗時は例外を throw する。 */
async function processCommunitePosts({
  community,
  deps,
  apiKey,
  generate,
  fetchFeed,
  recentLimit,
  slotKey,
  rng,
  now,
  dripWindowMs,
  postRange,
  currentWorkerStates,
  botWorkersPromise,
}: {
  community: CommunityRecord;
  deps: RunPostBatchDeps;
  apiKey: string;
  generate: ConversationGenerator;
  fetchFeed: FetchFeed;
  recentLimit: number;
  slotKey: string;
  rng: () => number;
  now: Date;
  dripWindowMs: number;
  postRange: { min: number; max: number };
  currentWorkerStates: Record<string, WorkerState>;
  botWorkersPromise: Promise<readonly WorkerRecord[]>;
}): Promise<CommunityPostResult> {
  const worldStateRepo = deps.worldStateRepository;
  const appearedWorkerIds = new Set<string>();

  // community 別の登場ワーカーを DB から解決する（limit 省略で全件取得・#1078）。
  const { items: communityWorkers } = await deps.workerCommunityRepo.listWorkersByCommunity({
    communityId: community.id,
  });
  const botWorkers = communityWorkers.length > 0 ? [] : await botWorkersPromise;
  const resolvedWorkers = selectCommunityWorkers({ communityWorkers, allBotWorkers: botWorkers });
  if (resolvedWorkers.length === 0) {
    logBatchInfo("post_batch.skipped_no_workers", { communityId: community.id });
    return { posts: [], appearedWorkerIds };
  }

  // 登場ローテーション（#464）: lastAppearedSlotKey の新旧で「最近登場していないワーカー」を優先。
  const rotatedWorkers = worldStateRepo
    ? (() => {
        const count = deps.appearingWorkerCount ?? resolvedWorkers.length;
        const orderedIds = selectRotatedWorkers({ workers: resolvedWorkers, workerStates: currentWorkerStates, count });
        const byId = new Map(resolvedWorkers.map((w) => [w.id, w]));
        return orderedIds.flatMap((id) => {
          const w = byId.get(id);
          return w ? [w] : [];
        });
      })()
    : resolvedWorkers;

  const workers: readonly WorkerDef[] = rotatedWorkers.map((w) => ({
    id: w.id,
    displayName: w.displayName,
    role: w.role,
    personality: w.personality,
    verbosity: w.verbosity,
  }));
  const workerIds = workers.map((w) => w.id);

  // 直近 post/comment のコンテキスト取得（#1019）と外部フィード記事取得（#491 / #1104 / ADR-0035）は
  // 互いに独立した I/O のため Promise.all で並行実行する。fetchFeed（既定 fetchExternalFeed）は
  // タイムアウト・HTTPエラー・パース失敗を内部で全て catch し空配列を返す契約のため、
  // ここでの追加 try/catch は不要（通常生成にフォールバックする）。feedUrl 未設定なら呼び出さない。
  const [{ recentLog, recentPostsForReply }, feedArticles] = await Promise.all([
    fetchRecentContext({
      postRepo: deps.postRepo,
      commentRepo: deps.commentRepo ?? {
        listByCommunity: async () => [],
        createMany: async () => [],
        listByPost: async () => [],
        findById: async () => null,
        countByPostIds: async () => new Map(),
        addScore: async () => null,
        listByWorker: async () => ({ comments: [], nextCursor: null }),
      },
      community,
      recentLimit,
      maxPostsForReply: recentLimit,
      now,
      popularPostsWindowDays: 7,
      popularPostsMinScore: 1,
      popularPostsLimit: 0,
    }),
    community.feedUrl
      ? fetchFeed({ feedUrl: community.feedUrl })
      : Promise.resolve<readonly FeedArticle[]>([]),
  ]);

  // post 件数を rng で決定する（#672 AC2）。
  const postCount = pickInRange(postRange.min, postRange.max, rng);

  // post 専用プロンプトを構築する（コメント生成なし）。
  const { prompt } = buildPostPrompt({
    community,
    workers,
    recentLog,
    countHints: { postCount },
    recentTitles: recentPostsForReply.map((p) => p.title),
    feedArticles,
  });

  // AI 生成 → JSON パース → スキーマ検証 → author 検証（最大 2 回リトライ、#626）。
  const { output, usage } = await withGenerationRetry({
    fn: async () => {
      const generationResult = await generate(prompt, apiKey);
      const raw = generationResult.text;

      // JSON パース。
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        logBatchError("post_batch.json_parse_failed", "JSON parse failed", { communityId: community.id });
        throw new RetryableGenerationError(`${community.id}: JSON パース失敗`);
      }

      // Zod スキーマ検証。
      const validated = GenerationOutputSchema.safeParse(parsed);
      if (!validated.success) {
        logBatchError("post_batch.schema_validation_failed", "schema validation failed", {
          communityId: community.id,
          issues: validated.error.format(),
        });
        throw new RetryableGenerationError(`${community.id}: スキーマ検証失敗`);
      }

      // author 検証（既知 workerId のみ許可）。
      try {
        validateGenerationOutput({ output: validated.data, knownWorkerIds: workerIds });
      } catch (err) {
        logBatchError("post_batch.author_validation_failed", err, { communityId: community.id });
        throw new RetryableGenerationError(`${community.id}: author 検証失敗`);
      }

      // usage が取得できた場合に記録する（#663）。
      let resolvedUsage: { model: string; inputTokens: number; outputTokens: number } | undefined;
      if (
        generationResult.model !== undefined &&
        generationResult.inputTokens !== undefined &&
        generationResult.outputTokens !== undefined
      ) {
        resolvedUsage = {
          model: generationResult.model,
          inputTokens: generationResult.inputTokens,
          outputTokens: generationResult.outputTokens,
        };
      }
      return { output: validated.data, usage: resolvedUsage };
    },
    maxRetries: 2,
    label: `post_batch.${community.id}`,
  });

  // 直近 post 本文とのテキスト類似度を検知する（#1115）。強いバリデーションではなく、
  // 検知してもログ記録のみで生成は失敗させない（#1022 の URL 検知と同じ非ブロッキング方針）。
  for (const post of output.posts) {
    const duplicateMatch = detectSimilarRecentPost({
      candidateText: post.text,
      recentPosts: recentPostsForReply,
    });
    if (duplicateMatch) {
      logBatchInfo("post_batch.duplicate_text_detected", {
        communityId: community.id,
        title: post.title,
        matchedTitle: duplicateMatch.matchedTitle,
        similarity: duplicateMatch.similarity,
      });
    }
  }

  // post に drip タイムスタンプを割り当てて永続化する（#672 AC4）。
  const totalPostCount = output.posts.length;
  const dripTimestamps = assignDripTimestamps({
    slotAt: now,
    windowMs: dripWindowMs,
    count: totalPostCount,
    rng,
  });

  // eslint-disable-next-line max-params
  const postInputs = output.posts.map((post, idx) => ({
    slotKey,
    seq: idx,
    author: post.author,
    title: post.title,
    text: post.text,
    createdAt: dripTimestamps[idx] ?? new Date(now.getTime() + idx * 1000),
    // 生成出力の tags をそのまま永続化する（#1087）。GenerationOutputPostSchema が
    // .default([]) を持つため post.tags は必ず配列。
    tags: post.tags,
  }));

  const savedPosts = await deps.postRepo.createMany(community.id, postInputs);

  // 登場ワーカーを記録する（#464）。
  for (const post of output.posts) {
    appearedWorkerIds.add(post.author);
  }

  // コミュニティごとに BatchRunLog と TokenUsageLog を記録する（#671 / ADR-0033）。
  const batchRunLog = await deps.batchRunLogRepository?.create({
    status: "success",
    messageCount: savedPosts.length,
    errorMessage: null,
    errorCode: null,
  });

  if (deps.tokenUsageLogRepository && usage) {
    await deps.tokenUsageLogRepository.create({
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      batchRunLogId: batchRunLog?.id ?? null,
    });
  }

  return { posts: savedPosts, appearedWorkerIds };
}

/**
 * post 専用の定時バッチ本体（#672）。
 *
 * 1 日 1 回起動し、全コミュニティを Promise.allSettled で並列処理する（ADR-0033 踹襲）。
 * 各コミュニティで 1～3 件の独立 post を生成し、24h 窓内に createdAt を分散させる。
 * comment は生成しない（comment バッチは #673 で別途実装）。
 */
export async function runPostBatch(deps: RunPostBatchDeps): Promise<RunPostBatchResult> {
  const apiKey = deps.anthropicApiKey;
  if (!apiKey) {
    logBatchInfo("post_batch.skipped_no_api_key");
    return { posts: [] };
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const fetchFeed = deps.fetchFeed ?? fetchExternalFeed;
  const recentLimit = deps.recentLimit ?? DEFAULT_RECENT_LIMIT;
  const slotKey = deps.slotKey ?? generateSlotKey();
  const rng = deps.rng ?? Math.random;
  const now = deps.now ?? new Date();
  const dripWindowMs = deps.dripWindowMs ?? DEFAULT_POST_DRIP_WINDOW_MS;
  const postRange = deps.postRange ?? { min: POST_COUNT_MIN, max: POST_COUNT_MAX };

  const communities = (await deps.communityRepo.list()).filter((c) => !c.generationPaused);

  if (communities.length === 0) {
    return { posts: [] };
  }

  // 登場ローテーション（#464）: worldStateRepository があれば現在の workerStates を読む。
  const worldStateRepo = deps.worldStateRepository;
  const currentWorldState = worldStateRepo ? await worldStateRepo.get() : null;
  const currentWorkerStates: Record<string, WorkerState> = currentWorldState?.workerStates ?? {};

  // botWorkerProvider を先に 1 回だけ呼び出す（N 重呼び出しを防ぐ）。
  const botWorkersPromise: Promise<readonly WorkerRecord[]> = deps.botWorkerProvider
    ? deps.botWorkerProvider()
    : Promise.resolve([]);

  // 全コミュニティを並列処理する（ADR-0033 踹襲）。
  const results = await Promise.allSettled(
    communities.map((community) =>
      processCommunitePosts({
        community,
        deps,
        apiKey,
        generate,
        fetchFeed,
        recentLimit,
        slotKey,
        rng,
        now,
        dripWindowMs,
        postRange,
        currentWorkerStates,
        botWorkersPromise,
      }),
    ),
  );

  const savedPosts: PostRecord[] = [];
  const appearedWorkerIds = new Set<string>();

  for (const [i, result] of results.entries()) {
    const community = communities[i]!;
    if (result.status === "fulfilled") {
      savedPosts.push(...result.value.posts);
      for (const id of result.value.appearedWorkerIds) {
        appearedWorkerIds.add(id);
      }
    } else {
      const message = extractErrorMessage(result.reason);
      logBatchError("post_batch.community_failed", result.reason, {
        communityId: community.id,
      });
      try {
        await deps.batchRunLogRepository?.create({
          status: "failure",
          messageCount: 0,
          errorMessage: message,
          errorCode: null,
        });
      } catch (logErr) {
        logBatchError("post_batch.failure_log_write_failed", logErr, {
          communityId: community.id,
        });
      }
    }
  }

  // 登場ローテーション更新（#464）。
  if (worldStateRepo && appearedWorkerIds.size > 0) {
    const nextWorkerStates: Record<string, WorkerState> = { ...currentWorkerStates };
    for (const workerId of appearedWorkerIds) {
      nextWorkerStates[workerId] = {
        ...nextWorkerStates[workerId],
        lastAppearedSlotKey: slotKey,
      };
    }
    await worldStateRepo.upsert({
      summaryVersion: currentWorldState?.summaryVersion ?? 0,
      workerStates: nextWorkerStates,
    });
  }

  return { posts: savedPosts };
}
