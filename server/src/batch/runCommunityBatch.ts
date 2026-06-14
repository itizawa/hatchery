import {
  type CommunityWeight,
  GenerationOutputSchema,
  formatRecentLog,
  type RecentEntry,
  selectCommunityWorkers,
  selectRotatedWorkers,
  selectWeightedCommunity,
  validateGenerationOutput,
  type WorkerState,
} from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { CommentRecord, CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRecord, CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRecord, PostRepository } from "../persistence/postRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import type { WorldStateRepository } from "../persistence/worldStateRepository.js";
import { getApiKey } from "../utils/apiKey.js";

import {
  generateConversationWithClaude,
  type ConversationGenerator,
} from "./aiMessageGenerator.js";
import { buildCommunityPrompt, type WorkerDef } from "./buildCommunityPrompt.js";

/** プロンプトに載せる直近 post/comment の既定件数。 */
const DEFAULT_RECENT_LIMIT = 30;

/**
 * vote 重みの集計対象期間（日数）。直近この日数の vote 純スコアで重みを算出する（#486 / ADR-0030）。
 * 後からチューニングしやすいよう名前付き定数として切り出す。
 */
export const VOTE_WEIGHT_WINDOW_DAYS = 7;

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
  appSettingRepo: AppSettingRepository;
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
   */
  rng?: () => number;
  /** vote 集計の基準「現在時刻」（省略時は実行時の `new Date()`）。テストで固定するため。 */
  now?: Date;
}

/**
 * 現在時刻から slot_key を生成する（"YYYY-MM-DDTHH:MM" 形式・UTC 基準）。
 * Cron 二重発火ガードに使う。実行環境のタイムゾーンに依存しない。
 */
export function generateSlotKey(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hour = pad(now.getUTCHours());
  const minute = pad(now.getUTCMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * vote 重み付きランダムで 1 コミュニティを選ぶ（#486 / ADR-0030）。
 *
 * 直近 VOTE_WEIGHT_WINDOW_DAYS 日の community 別純 vote スコア（up−down）を集計し、
 * `weight = max(0, 純vote) + 1`（cold start 床 +1）で重みを作って重み付きランダム選定する。
 * 床 +1 により vote 0・新規コミュニティも必ず正の重みを持ち、稀に選ばれる。
 *
 * @returns 選ばれた CommunityRecord。community が 0 件のときは null。
 */
async function selectOneCommunity(
  communities: readonly CommunityRecord[],
  voteRepo: VoteRepository,
  rng: () => number,
  now: Date,
): Promise<CommunityRecord | null> {
  if (communities.length === 0) return null;

  const since = new Date(now.getTime() - VOTE_WEIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const netScores = await voteRepo.netScoresByCommunitySince(since);

  const weights: CommunityWeight[] = communities.map((community) => ({
    communityId: community.id,
    // cold start 床: weight = max(0, 純vote) + 1。
    weight: Math.max(0, netScores.get(community.id) ?? 0) + 1,
  }));

  const selectedId = selectWeightedCommunity(weights, rng);
  if (selectedId === null) return null;
  return communities.find((c) => c.id === selectedId) ?? null;
}

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
  const apiKey = await getApiKey(deps.appSettingRepo, deps.anthropicApiKey);
  if (!apiKey) {
    console.error("[communityBatch] API キーが設定されていないためスキップします");
    return { posts: [], comments: [] };
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const recentLimit = deps.recentLimit ?? DEFAULT_RECENT_LIMIT;
  const slotKey = deps.slotKey ?? generateSlotKey();
  const rng = deps.rng ?? Math.random;
  const now = deps.now ?? new Date();

  const communities = await deps.communityRepo.list();

  const savedPosts: PostRecord[] = [];
  const savedComments: CommentRecord[] = [];
  const errors: string[] = [];

  // 登場ローテーション（#464）: worldStateRepository があれば現在の workerStates を読み、
  // 生成成功後に登場ワーカーの lastAppearedSlotKey を更新する。
  const worldStateRepo = deps.worldStateRepository;
  const currentWorldState = worldStateRepo ? await worldStateRepo.get() : null;
  const currentWorkerStates: Record<string, WorkerState> = currentWorldState?.workerStates ?? {};
  // 今回の定時で実際に登場した（プロンプト・検証に使った）ワーカー id を集める。
  const appearedWorkerIds = new Set<string>();

  // vote 重み付きランダムで 1 コミュニティを選ぶ（#486 / ADR-0030）。
  const selected = await selectOneCommunity(communities, deps.voteRepo, rng, now);
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
        console.warn(
          `[communityBatch] community ${community.id} に紐づくワーカーが 0 件のためスキップします。`,
        );
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
      }));
      const workerIds = workers.map((w) => w.id);

      // 直近 post/comment をログ形式に変換
      const recentPosts = await deps.postRepo.listByCommunity(community.id, recentLimit);
      const recentComments = await deps.commentRepo.listByCommunity(community.id, recentLimit);
      // post と comment を createdAt で時系列マージし直近 recentLimit 件をプロンプトに載せる
      const allEntries: (RecentEntry & { createdAt: Date })[] = [
        ...recentPosts.map((p) => ({
          community_id: community.slug,
          author: p.author,
          text: p.text,
          title: p.title,
          createdAt: p.createdAt,
        })),
        ...recentComments.map((c) => ({
          community_id: community.slug,
          author: c.author,
          text: c.text,
          createdAt: c.createdAt,
        })),
      ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const recentLog = formatRecentLog(allEntries, recentLimit);

      // プロンプト構築（お題は含めない・ADR-0020）
      const prompt = buildCommunityPrompt({
        community,
        workers,
        recentLog,
      });

      // AI 生成（1 コミュニティ = 1 API コール・ADR-0009）
      const raw = await generate(prompt, apiKey);

      // JSON パース（失敗時はスキップ）
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error(
          `[communityBatch] community ${community.id} の生成出力の JSON パースに失敗しました。スキップします。`,
        );
        errors.push(`${community.id}: JSON パース失敗`);
        continue;
      }

      // Zod スキーマ検証
      const validated = GenerationOutputSchema.safeParse(parsed);
      if (!validated.success) {
        console.error(
          `[communityBatch] community ${community.id} の生成出力のスキーマ検証に失敗しました。スキップします。`,
          validated.error.format(),
        );
        errors.push(`${community.id}: スキーマ検証失敗`);
        continue;
      }

      const output = validated.data;

      // author 検証（既知 workerId のみ許可・ADR-0020）
      try {
        validateGenerationOutput(output, workerIds);
      } catch (err) {
        console.error(
          `[communityBatch] community ${community.id} の生成出力の author 検証に失敗しました。スキップします。`,
          err instanceof Error ? err.message : String(err),
        );
        errors.push(`${community.id}: author 検証失敗`);
        continue;
      }

      // post をバルク作成（(community_id, slot_key, seq) 複合ユニーク制約でガード）
      const postInputs = output.posts.map((post, postIdx) => ({
        slotKey,
        seq: postIdx,
        author: post.author,
        title: post.title,
        text: post.text,
      }));
      const createdPosts = await deps.postRepo.createMany(community.id, postInputs);
      savedPosts.push(...createdPosts);

      // comment をバルク作成
      // seq は全コメントを通じてユニークにする（community + slotKey でフラット管理）
      let commentSeq = 0;
      for (let postIdx = 0; postIdx < output.posts.length; postIdx++) {
        const post = output.posts[postIdx];
        const createdPost = createdPosts[postIdx];
        if (!post || !createdPost) continue;

        if (post.comments.length === 0) continue;

        const commentInputs = post.comments.map((comment) => ({
          postId: createdPost.id,
          slotKey,
          seq: commentSeq++,
          author: comment.author,
          text: comment.text,
        }));
        const createdComments = await deps.commentRepo.createMany(community.id, commentInputs);
        savedComments.push(...createdComments);
      }

      // 生成・永続化に成功したので、この定時で登場したワーカーを記録する（#464）。
      // post / comment の author として実際に発言したワーカーを登場扱いにする（author 検証済みの既知 id）。
      for (const post of output.posts) {
        appearedWorkerIds.add(post.author);
        for (const comment of post.comments) {
          appearedWorkerIds.add(comment.author);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[communityBatch] community ${community.id} の処理に失敗しました:`, err);
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

  // バッチ実行ログを保存
  await deps.batchRunLogRepository?.create({
    status: errors.length > 0 ? "failure" : "success",
    messageCount: savedPosts.length + savedComments.length,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
    errorCode: null,
  });

  return { posts: savedPosts, comments: savedComments };
}
