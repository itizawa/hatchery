import {
  GenerationOutputSchema,
  generateSlotKey,
  selectCommunityWorkers,
  selectRotatedWorkers,
  validateGenerationOutput,
  type WorkerState,
} from "@hatchery/common";

import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { CommentRecord, CommentRepository } from "../persistence/commentRepository.js";
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
import { buildCommunityPrompt, type WorkerDef } from "./buildCommunityPrompt.js";
import { fetchRecentContext } from "./fetchRecentContext.js";
import { generateCountHints } from "./generateCountHints.js";
import { extractErrorMessage, logBatchError, logBatchInfo } from "./logger.js";
import { persistBatchOutput } from "./persistBatchOutput.js";

/** プロンプトに載せる直近 post/comment の既定件数。 */
const DEFAULT_RECENT_LIMIT = 30;

/**
 * プロンプトに露出する既存Post参照の最大件数（#555）。
 * 生成品質・コストを考慮して最新 N 件に絞る。
 */
const MAX_RECENT_POSTS_FOR_REPLY = 5;

/**
 * バッチのドリップ窓のデフォルト値（ms）（#556）。
 * DEFAULT_BATCH_HOURS = [9,12,15,18] のスロット間隔 3h に合わせた既定値。
 * env.batchDripWindowMs から上書き可能（communityBatchIndex.ts で注入）。
 */
const DEFAULT_DRIP_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 時間

/**
 * 人気トピック還元の集計対象期間（日数）（#558）。
 * 直近この日数の post のうちスコアが高いものを生成プロンプトに渡す。
 */
export const POPULAR_POSTS_WINDOW_DAYS = 7;

/**
 * 人気トピック還元の最小スコア閾値（#558）。
 * この値以上のスコアを持つ post のみをプロンプトに渡す（0 以下は除外）。
 */
export const POPULAR_POSTS_MIN_SCORE = 1;

/**
 * 人気トピック還元のプロンプトに載せる件数上限（#558）。
 * スコア降順でこの件数まで載せる。
 */
export const POPULAR_POSTS_LIMIT = 3;

/** community バッチの実行結果。 */
export interface RunCommunityBatchResult {
  posts: PostRecord[];
  comments: CommentRecord[];
}

/** community バッチの依存インターフェース（テスト用注入対応）。 */
export interface RunCommunityBatchDeps {
  communityRepo: CommunityRepository;
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  /**
   * WorkerCommunity 経由で community 別の登場ワーカーを DB から解決する（#489）。
   * community ごとにこのリポジトリで紐づくワーカーを取得し、生成・author 検証に使う。
   */
  workerCommunityRepo: WorkerCommunityRepository;
  /**
   * 紐づくワーカーが 0 件の community のフォールバック先（全 Bot ワーカー）（#489）。
   * 省略時はフォールバックせず、紐づき 0 件の community は生成をスキップする。
   * CLI では workerRepo.listBotWorkers を渡す。
   */
  botWorkerProvider?: () => Promise<readonly WorkerRecord[]>;
  /** バッチ実行ログの永続化（省略時はログ保存しない）。 */
  batchRunLogRepository?: BatchRunLogRepository;
  /**
   * トークン使用量の記録（省略時は記録しない）（#663）。
   * generate() が usage を返したときのみ create() を呼ぶ。
   * API キー未設定 / community 0 件でスキップした定時は記録しない。
   */
  tokenUsageLogRepository?: TokenUsageLogRepository;
  /**
   * 登場ローテーション用の WorldState 永続化（#464）。
   * 注入されたときのみ、(a) 解決した登場ワーカーを lastAppearedSlotKey の新旧で並べ替え（最近登場
   * していないワーカー優先）、(b) 生成・永続化に成功した定時の登場ワーカーの lastAppearedSlotKey を
   * 当該 slotKey に upsert する。省略時はローテーション・更新を行わない（後方互換）。
   */
  worldStateRepository?: WorldStateRepository;
  /**
   * 1 定時に登場させる最大ワーカー人数（#464）。worldStateRepository があるときに有効。
   * 省略時は解決した全ワーカーを対象にする（既存挙動を維持）。
   */
  appearingWorkerCount?: number;
  /** テスト用に注入可能な AI 生成関数。省略時は Claude を使う。 */
  generate?: ConversationGenerator;
  /** プロンプトに載せる直近 post/comment 件数（既定 30）。 */
  recentLimit?: number;
  /**
   * 定時キー（省略時は現在時刻から "YYYY-MM-DDTHH:MM" 形式を自動生成）。
   * テストで固定 slotKey を使う場合に注入する。
   */
  slotKey?: string;
  /** ANTHROPIC_API_KEY の env 値。DB に CLAUDE_API_KEY がないときのフォールバック（#419）。 */
  anthropicApiKey?: string;
  /**
   * 乱数源（`[0, 1)`）。既定 `Math.random`。
   * countHints の生成・ドリップ割当に使う。
   */
  rng?: () => number;
  /** バッチの「現在時刻」（省略時は実行時の `new Date()`）。テストで固定するため。 */
  now?: Date;
  /**
   * 1 定時の post 数の範囲（#557）。省略時は件数誘導なし（後方互換）。
   * min/max を指定するとプロンプトに「N 件」の誘導を追加する。
   */
  postRange?: { min: number; max: number };
  /**
   * 各 post のコメント数の範囲（#557）。省略時は件数誘導なし（後方互換）。
   * min/max を指定するとプロンプトに「M 件前後」の誘導を追加する。
   */
  commentRange?: { min: number; max: number };
  /**
   * ドリップ窓（ms）（#556）。
   * 各コメントの createdAt をこの窓の中に散らして「じわじわ」公開する。
   * 省略時は DEFAULT_DRIP_WINDOW_MS（3h）。env.batchDripWindowMs から注入する。
   */
  dripWindowMs?: number;
}

/**
 * generateSlotKey は common へ移設済み（#597）。後方互換のため re-export する。
 * @deprecated common から直接インポートすること。
 */
export { generateSlotKey } from "@hatchery/common";

/** 1 コミュニティの処理結果（内部型）。 */
interface CommunityBatchResult {
  posts: PostRecord[];
  comments: CommentRecord[];
  appearedWorkerIds: Set<string>;
}

/**
 * 1 コミュニティを処理する内部関数（#671 / ADR-0033）。
 * 成功時は CommunityBatchResult を返す。失敗時は例外を throw する。
 */
async function processCommunity({
  community,
  deps,
  apiKey,
  generate,
  recentLimit,
  slotKey,
  rng,
  now,
  dripWindowMs,
  currentWorkerStates,
}: {
  community: CommunityRecord;
  deps: RunCommunityBatchDeps;
  apiKey: string;
  generate: ConversationGenerator;
  recentLimit: number;
  slotKey: string;
  rng: () => number;
  now: Date;
  dripWindowMs: number;
  currentWorkerStates: Record<string, WorkerState>;
}): Promise<CommunityBatchResult> {
  const worldStateRepo = deps.worldStateRepository;
  const appearedWorkerIds = new Set<string>();

  // community 別の登場ワーカーを DB から解決する（#489）。
  const communityWorkers = await deps.workerCommunityRepo.listWorkersByCommunity(community.id);
  const botWorkers =
    communityWorkers.length > 0 ? [] : ((await deps.botWorkerProvider?.()) ?? []);
  const resolvedWorkers = selectCommunityWorkers(communityWorkers, botWorkers);
  if (resolvedWorkers.length === 0) {
    logBatchInfo("community_batch.skipped_no_workers", { communityId: community.id });
    return { posts: [], comments: [], appearedWorkerIds };
  }

  // 登場ローテーション（#464）: lastAppearedSlotKey の新旧で「最近登場していないワーカー」を優先して並べ替え・絞り込む。
  const rotatedWorkers = worldStateRepo
    ? (() => {
        const count = deps.appearingWorkerCount ?? resolvedWorkers.length;
        const orderedIds = selectRotatedWorkers(resolvedWorkers, currentWorkerStates, count);
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

  // 直近 post/comment・人気トピックをコンテキストとして取得する
  const { recentLog, recentPostsForReply, popularPosts } = await fetchRecentContext({
    postRepo: deps.postRepo,
    commentRepo: deps.commentRepo,
    community,
    recentLimit,
    maxPostsForReply: MAX_RECENT_POSTS_FOR_REPLY,
    now,
    popularPostsWindowDays: POPULAR_POSTS_WINDOW_DAYS,
    popularPostsMinScore: POPULAR_POSTS_MIN_SCORE,
    popularPostsLimit: POPULAR_POSTS_LIMIT,
  });

  // post 数・コメント数のヒントを生成する（#557）。
  const countHints =
    deps.postRange && deps.commentRange
      ? generateCountHints(deps.postRange, deps.commentRange, rng)
      : undefined;

  // プロンプト構築（お題は含めない・ADR-0020）
  const { prompt, postRefMap } = buildCommunityPrompt({
    community,
    workers,
    recentLog,
    recentPosts: recentPostsForReply,
    popularPosts,
    countHints,
  });

  // AI 生成（1 コミュニティ = 1 API コール・ADR-0009）
  const generationResult = await generate(prompt, apiKey);
  const raw = generationResult.text;

  // usage が取得できた場合に記録する（#663）
  let usage: { model: string; inputTokens: number; outputTokens: number } | undefined;
  if (
    generationResult.model !== undefined &&
    generationResult.inputTokens !== undefined &&
    generationResult.outputTokens !== undefined
  ) {
    usage = {
      model: generationResult.model,
      inputTokens: generationResult.inputTokens,
      outputTokens: generationResult.outputTokens,
    };
  }

  // JSON パース（失敗時はエラーを throw して allSettled に吸収させる）
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logBatchError("community_batch.json_parse_failed", "JSON parse failed", {
      communityId: community.id,
    });
    throw new Error(`${community.id}: JSON パース失敗`);
  }

  // Zod スキーマ検証
  const validated = GenerationOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logBatchError("community_batch.schema_validation_failed", "schema validation failed", {
      communityId: community.id,
      issues: validated.error.format(),
    });
    throw new Error(`${community.id}: スキーマ検証失敗`);
  }

  const output = validated.data;

  // author 検証（既知 workerId のみ許可・ADR-0020）+ reply の targetPostRef 検証（#555）
  const knownPostRefs = postRefMap.size > 0 ? new Set(postRefMap.keys()) : undefined;
  try {
    validateGenerationOutput(output, workerIds, knownPostRefs);
  } catch (err) {
    logBatchError("community_batch.author_validation_failed", err, {
      communityId: community.id,
    });
    throw new Error(`${community.id}: author 検証失敗`);
  }

  // post / comment / reply を永続化する
  const persisted = await persistBatchOutput({
    postRepo: deps.postRepo,
    commentRepo: deps.commentRepo,
    communityId: community.id,
    output,
    postRefMap,
    slotKey,
    commentSeqStart: 0,
    now,
    dripWindowMs,
    rng,
  });

  // 生成・永続化に成功したので、この定時で登場したワーカーを記録する（#464）。
  for (const post of output.posts) {
    appearedWorkerIds.add(post.author);
    for (const comment of post.comments) {
      appearedWorkerIds.add(comment.author);
    }
  }
  for (const reply of output.replies ?? []) {
    appearedWorkerIds.add(reply.author);
  }

  // コミュニティごとに BatchRunLog と TokenUsageLog を記録する（#671 / ADR-0033）
  const batchRunLog = await deps.batchRunLogRepository?.create({
    status: "success",
    messageCount: persisted.savedPosts.length + persisted.savedComments.length,
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

  return {
    posts: persisted.savedPosts,
    comments: persisted.savedComments,
    appearedWorkerIds,
  };
}

/**
 * community 単位の定時バッチ本体（#306 / #671 / ADR-0019 / ADR-0020 / ADR-0009 / ADR-0033）。
 *
 * **1 定時 = 全コミュニティを Promise.allSettled で並列処理**（ADR-0033、ADR-0030 を supersede）。
 * 各コミュニティは独立して処理され、1 コミュニティの失敗は他のコミュニティに影響しない。
 *
 * 1. 全 community を取得（0 件 → 空返し）
 * 2. Promise.allSettled(communities.map(...)) で全コミュニティを並列処理
 *    - 各コミュニティ: ワーカー解決 → プロンプト構築 → 1 API コール → 検証 → 永続化 → BatchRunLog
 *    - 失敗コミュニティ: BatchRunLog(failure) を記録して空配列を返す
 * 3. 全結果を集約して返す
 * 4. WorldState を一度だけ upsert（全コミュニティで登場した worker を集約）
 */
export async function runCommunityBatch(
  deps: RunCommunityBatchDeps,
): Promise<RunCommunityBatchResult> {
  const apiKey = deps.anthropicApiKey;
  if (!apiKey) {
    logBatchInfo("community_batch.skipped_no_api_key");
    return { posts: [], comments: [] };
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const recentLimit = deps.recentLimit ?? DEFAULT_RECENT_LIMIT;
  const slotKey = deps.slotKey ?? generateSlotKey();
  const rng = deps.rng ?? Math.random;
  const now = deps.now ?? new Date();
  const dripWindowMs = deps.dripWindowMs ?? DEFAULT_DRIP_WINDOW_MS;

  const communities = await deps.communityRepo.list();

  if (communities.length === 0) {
    return { posts: [], comments: [] };
  }

  // 登場ローテーション（#464）: worldStateRepository があれば現在の workerStates を読み、
  // 全コミュニティ処理完了後に登場ワーカーの lastAppearedSlotKey を一括 upsert する。
  const worldStateRepo = deps.worldStateRepository;
  const currentWorldState = worldStateRepo ? await worldStateRepo.get() : null;
  const currentWorkerStates: Record<string, WorkerState> = currentWorldState?.workerStates ?? {};

  // 全コミュニティを並列処理する（#671 / ADR-0033）
  const results = await Promise.allSettled(
    communities.map((community) =>
      processCommunity({
        community,
        deps,
        apiKey,
        generate,
        recentLimit,
        slotKey,
        rng,
        now,
        dripWindowMs,
        currentWorkerStates,
      }),
    ),
  );

  const savedPosts: PostRecord[] = [];
  const savedComments: CommentRecord[] = [];
  const appearedWorkerIds = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const community = communities[i];
    if (result.status === "fulfilled") {
      savedPosts.push(...result.value.posts);
      savedComments.push(...result.value.comments);
      for (const id of result.value.appearedWorkerIds) {
        appearedWorkerIds.add(id);
      }
    } else {
      const message = extractErrorMessage(result.reason);
      logBatchError("community_batch.community_failed", result.reason, {
        communityId: community.id,
      });
      // 失敗コミュニティごとに BatchRunLog(failure) を記録する（#671 / ADR-0033）
      await deps.batchRunLogRepository?.create({
        status: "failure",
        messageCount: 0,
        errorMessage: message,
        errorCode: null,
      });
    }
  }

  // 登場ローテーション更新（#464）: 今回登場したワーカーの lastAppearedSlotKey を当該 slotKey に
  // upsert する。worldStateRepository 未注入時・登場ワーカー 0 時は更新しない。
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

  return { posts: savedPosts, comments: savedComments };
}
