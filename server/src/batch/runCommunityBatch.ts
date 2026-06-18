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
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRecord, PostRepository } from "../persistence/postRepository.js";
import type { TokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
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
import { selectOneCommunity } from "./selectTargetCommunity.js";

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

/** vote 重みの集計対象期間（日数）。selectTargetCommunity.ts へ移設済み。後方互換のため re-export。 */
export { VOTE_WEIGHT_WINDOW_DAYS } from "./selectTargetCommunity.js";

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
   * vote 集計（重み算出）用リポジトリ（#486 / ADR-0030）。
   * 直近 VOTE_WEIGHT_WINDOW_DAYS 日の community 別純スコアで重み付き 1 コミュニティ選定を行う。
   */
  voteRepo: VoteRepository;
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
   * 重み付き 1 コミュニティ選定に使う乱数源（`[0, 1)`）。既定 `Math.random`（#486）。
   * テストでは固定値を注入して選定を決定化する。
   * countHints の生成にも同じ rng を流用する（#557）。
   * ドリップ割当（assignDripTimestamps）にも同じ rng を流用する（#556）。
   */
  rng?: () => number;
  /** vote 集計の基準「現在時刻」（省略時は実行時の `new Date()`）。テストで固定するため。 */
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

/**
 * community 単位の定時バッチ本体（#306 / #486 / ADR-0019 / ADR-0020 / ADR-0009 / ADR-0030）。
 *
 * **1 定時 = vote 重み付きランダムで 1 コミュニティだけを選び、そのコミュニティのみ生成する**（ADR-0030）。
 * これにより 1 定時の Claude API コールは常に最大 1 回でコミュニティ数に依存しない。
 *
 * 1. 全 community を取得し、直近 VOTE_WEIGHT_WINDOW_DAYS 日の community 別純 vote スコア（up−down）を集計
 * 2. `weight = max(0, 純vote) + 1`（cold start 床）で重みを作り、重み付きランダムで 1 community を選定
 * 3. 選ばれた community について:
 *    a. 直近 post/comment ログ（formatRecentLog）を組み立て
 *    b. community の description + worker 定義 + 直近ログでプロンプト構築
 *    c. 1 API コールで生成（{ topic, posts: [...] } の JSON）
 *    d. common の GenerationOutputSchema + validateGenerationOutput で検証
 *    e. 検証を通った post/comment を (community_id, slot_key, seq) 複合ユニーク制約で永続化
 *
 * エラーハンドリング:
 * - API キー未設定 → 何も生成せず空を返す（スキップ）。
 * - community 0 件 → 何も生成せず正常終了。
 * - 選定 community の JSON パース / author 検証失敗 → 永続化せず空を返す（その定時はスキップ）。
 * - score は生成出力に含まれていても無視する（永続化時に 0 固定・ADR-0019）。
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

  const savedPosts: PostRecord[] = [];
  const savedComments: CommentRecord[] = [];
  const errors: string[] = [];
  let pendingUsage: { model: string; inputTokens: number; outputTokens: number } | undefined;

  // 登場ローテーション（#464）: worldStateRepository があれば現在の workerStates を読み、
  // 生成成功後に登場ワーカーの lastAppearedSlotKey を更新する。
  const worldStateRepo = deps.worldStateRepository;
  const currentWorldState = worldStateRepo ? await worldStateRepo.get() : null;
  const currentWorkerStates: Record<string, WorkerState> = currentWorldState?.workerStates ?? {};
  // 今回の定時で実際に登場した（プロンプト・検証に使った）ワーカー id を集める。
  const appearedWorkerIds = new Set<string>();

  // vote 重み付きランダムで 1 コミュニティを選ぶ（#486 / ADR-0030）。
  const selected = await selectOneCommunity({ communities, voteRepo: deps.voteRepo, rng, now });
  if (!selected) {
    // community 0 件 → 何も生成せず正常終了（既存のスキップ挙動と整合）。
    await deps.batchRunLogRepository?.create({
      status: "success",
      messageCount: 0,
      errorMessage: null,
      errorCode: null,
    });
    return { posts: [], comments: [] };
  }

  for (const community of [selected]) {
    try {
      // community 別の登場ワーカーを DB から解決する（#489）。
      // WorkerCommunity で紐づくワーカー → 0 件なら全 Bot ワーカーへフォールバック。
      const communityWorkers = await deps.workerCommunityRepo.listWorkersByCommunity(community.id);
      const botWorkers =
        communityWorkers.length > 0 ? [] : ((await deps.botWorkerProvider?.()) ?? []);
      const resolvedWorkers = selectCommunityWorkers(communityWorkers, botWorkers);
      // 登場ワーカーが 1 人もいない community は生成をスキップする（#489 AC3）。
      if (resolvedWorkers.length === 0) {
        logBatchInfo("community_batch.skipped_no_workers", { communityId: community.id });
        continue;
      }
      // 登場ローテーション（#464）: lastAppearedSlotKey の新旧で「最近登場していないワーカー」を
      // 優先して並べ替え・絞り込む。worldStateRepository 未注入時は全員を解決順のまま使う。
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
      // postRange / commentRange が注入されていれば rng で件数を決定し、countHints としてプロンプトに渡す。
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
      // usage が取得できた場合は後で記録する（#663）
      if (
        generationResult.model !== undefined &&
        generationResult.inputTokens !== undefined &&
        generationResult.outputTokens !== undefined
      ) {
        pendingUsage = {
          model: generationResult.model,
          inputTokens: generationResult.inputTokens,
          outputTokens: generationResult.outputTokens,
        };
      }

      // JSON パース（失敗時はスキップ）
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        logBatchError("community_batch.json_parse_failed", "JSON parse failed", {
          communityId: community.id,
        });
        errors.push(`${community.id}: JSON パース失敗`);
        continue;
      }

      // Zod スキーマ検証
      const validated = GenerationOutputSchema.safeParse(parsed);
      if (!validated.success) {
        logBatchError("community_batch.schema_validation_failed", "schema validation failed", {
          communityId: community.id,
          issues: validated.error.format(),
        });
        errors.push(`${community.id}: スキーマ検証失敗`);
        continue;
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
        errors.push(`${community.id}: author 検証失敗`);
        continue;
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
      savedPosts.push(...persisted.savedPosts);
      savedComments.push(...persisted.savedComments);

      // 生成・永続化に成功したので、この定時で登場したワーカーを記録する（#464）。
      // post / comment / reply の author として実際に発言したワーカーを登場扱いにする（author 検証済みの既知 id）。
      for (const post of output.posts) {
        appearedWorkerIds.add(post.author);
        for (const comment of post.comments) {
          appearedWorkerIds.add(comment.author);
        }
      }
      for (const reply of output.replies ?? []) {
        appearedWorkerIds.add(reply.author);
      }
    } catch (err) {
      const message = extractErrorMessage(err);
      logBatchError("community_batch.community_failed", err, { communityId: community.id });
      errors.push(`${community.id}: ${message}`);
    }
  }

  // 登場ローテーション更新（#464）: 今回登場したワーカーの lastAppearedSlotKey を当該 slotKey に
  // upsert する。worldStateRepository 未注入時・登場ワーカー 0（スキップ・生成失敗）時は更新しない。
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

  // バッチ実行ログを保存し、ID をトークン使用量の紐づけに使う（#663）
  const batchRunLog = await deps.batchRunLogRepository?.create({
    status: errors.length > 0 ? "failure" : "success",
    messageCount: savedPosts.length + savedComments.length,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
    errorCode: null,
  });

  // トークン使用量を記録（generate が usage を返した定時のみ・#663）
  if (deps.tokenUsageLogRepository && pendingUsage) {
    await deps.tokenUsageLogRepository.create({
      model: pendingUsage.model,
      inputTokens: pendingUsage.inputTokens,
      outputTokens: pendingUsage.outputTokens,
      batchRunLogId: batchRunLog?.id ?? null,
    });
  }

  return { posts: savedPosts, comments: savedComments };
}
