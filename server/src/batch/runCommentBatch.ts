import { CommentBatchOutputSchema, selectCommunityWorkers } from "@hatchery/common";

import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { CommentRecord, CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRecord, CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { TokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";
import {
  generateConversationWithClaude,
  type ConversationGenerator,
} from "./aiMessageGenerator.js";
import { assignDripTimestamps } from "./assignDripTimestamps.js";
import { buildCommentBatchPrompt, type TargetPostForComment } from "./buildCommentBatchPrompt.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";
import { calcCommentCount, pickOldPostForRevival, REVIVAL_PROBABILITY } from "./calcCommentCounts.js";
import { extractErrorMessage, logBatchError, logBatchInfo } from "./logger.js";
import { withGenerationRetry, RetryableGenerationError } from "./withGenerationRetry.js";

/** comment バッチが対象とする直近 post の日数（#673）。 */
export const COMMENT_TARGET_WINDOW_DAYS = 3;

/**
 * comment バッチのデフォルトドリップ窓（ms）（#673）。
 * 1 日 4 回起動を想定し 3h 内に comment の createdAt を散らす。
 */
export const DEFAULT_COMMENT_DRIP_WINDOW_MS = 3 * 60 * 60 * 1000;

/** 古い post を取得する際の上限件数（#673）。 */
const OLD_POSTS_LIMIT = 20;

/** comment バッチの実行結果。 */
export interface RunCommentBatchResult {
  comments: CommentRecord[];
}

/** comment バッチの依存インターフェース（テスト用注入対応）。 */
export interface RunCommentBatchDeps {
  communityRepo: CommunityRepository;
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  workerCommunityRepo: WorkerCommunityRepository;
  botWorkerProvider?: () => Promise<readonly WorkerRecord[]>;
  batchRunLogRepository?: BatchRunLogRepository;
  tokenUsageLogRepository?: TokenUsageLogRepository;
  generate?: ConversationGenerator;
  slotKey?: string;
  anthropicApiKey?: string;
  rng?: () => number;
  now?: Date;
  dripWindowMs?: number;
  /** 古い post を活性化する確率（省略時は REVIVAL_PROBABILITY）。 */
  revivalProbability?: number;
}

/** 1 コミュニティ分のコメントを生成・永続化する（#673）。失敗時は例外を throw する。 */
async function processCommunityComments({
  community,
  deps,
  apiKey,
  generate,
  slotKey,
  rng,
  now,
  dripWindowMs,
  revivalProbability,
  botWorkersPromise,
}: {
  community: CommunityRecord;
  deps: RunCommentBatchDeps;
  apiKey: string;
  generate: ConversationGenerator;
  slotKey: string;
  rng: () => number;
  now: Date;
  dripWindowMs: number;
  revivalProbability: number;
  botWorkersPromise: Promise<readonly WorkerRecord[]>;
}): Promise<CommentRecord[]> {
  // community 別の登場ワーカーを解決する。
  const communityWorkers = await deps.workerCommunityRepo.listWorkersByCommunity(community.id);
  const botWorkers = communityWorkers.length > 0 ? [] : await botWorkersPromise;
  const resolvedWorkers = selectCommunityWorkers({ communityWorkers, allBotWorkers: botWorkers });
  if (resolvedWorkers.length === 0) {
    logBatchInfo("comment_batch.skipped_no_workers", { communityId: community.id });
    return [];
  }

  const workers: readonly WorkerDef[] = resolvedWorkers.map((w) => ({
    id: w.id,
    displayName: w.displayName,
    role: w.role,
    personality: w.personality,
    verbosity: w.verbosity,
  }));
  const workerIds = workers.map((w) => w.id);

  // 直近3日以内の post を取得する。
  const since = new Date(now.getTime() - COMMENT_TARGET_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentPosts = await deps.postRepo.listRecentByCommunity(community.id, since);

  // 古い post を revival 確率で1件追加する。
  const oldPosts = await deps.postRepo.listOldByCommunity(community.id, since, OLD_POSTS_LIMIT);
  const revivalPost = pickOldPostForRevival(oldPosts, revivalProbability, rng);

  const allTargetPosts = revivalPost
    ? [...recentPosts, revivalPost]
    : recentPosts;

  if (allTargetPosts.length === 0) {
    logBatchInfo("comment_batch.skipped_no_posts", { communityId: community.id });
    return [];
  }

  // 各 post のコメント数を vote スコアから計算し、TargetPostForComment を構築する。
  // eslint-disable-next-line max-params
  const targetPosts: TargetPostForComment[] = allTargetPosts.map((post, idx) => ({
    ref: `ref-${idx + 1}`,
    id: post.id,
    title: post.title,
    text: post.text,
    authorId: post.author,
    commentCount: calcCommentCount(post.score),
    existingComments: [],
  }));

  // ref -> 投稿者ワーカーID（自己返信除外・#1069）。
  const targetPostAuthorByRef = new Map(targetPosts.map((p) => [p.ref, p.authorId]));

  const { prompt, postRefMap } = buildCommentBatchPrompt({
    community,
    workers,
    recentLog: [],
    targetPosts,
  });

  // AI 生成 → JSON パース → スキーマ検証 → author 検証（最大 2 回リトライ、#626）。
  const knownWorkerIds = new Set(workerIds);
  const { output, usage } = await withGenerationRetry({
    fn: async () => {
      const generationResult = await generate(prompt, apiKey);
      const raw = generationResult.text;

      // JSON パース。
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        logBatchError("comment_batch.json_parse_failed", "JSON parse failed", { communityId: community.id });
        throw new RetryableGenerationError(`${community.id}: JSON パース失敗`);
      }

      // Zod スキーマ検証。
      const validated = CommentBatchOutputSchema.safeParse(parsed);
      if (!validated.success) {
        logBatchError("comment_batch.schema_validation_failed", "schema validation failed", {
          communityId: community.id,
          issues: validated.error.format(),
        });
        throw new RetryableGenerationError(`${community.id}: スキーマ検証失敗`);
      }

      // author 検証（既知 workerId のみ許可）。
      for (const postOutput of validated.data.posts) {
        for (const comment of postOutput.comments) {
          if (!knownWorkerIds.has(comment.author)) {
            logBatchError("comment_batch.author_validation_failed", "unknown author", {
              communityId: community.id,
              author: comment.author,
            });
            throw new RetryableGenerationError(`${community.id}: author 検証失敗`);
          }
        }
      }

      // usage が取得できた場合に記録する。
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
    label: `comment_batch.${community.id}`,
  });

  // 投稿者自身のコメントを post ごとに事前フィルタする（自己返信禁止・#1069）。
  // drip タイムスタンプの総数をフィルタ後の件数で算出するため、永続化ループの前に行う。
  // 元のインデックスは reply_to 解決のため保持する。
  type GenComment = (typeof output.posts)[number]["comments"][number];
  const filteredEntriesByRef = new Map<string, Array<{ comment: GenComment; originalIndex: number }>>();
  let totalCommentCount = 0;

  for (const postOutput of output.posts) {
    const targetPostId = postRefMap.get(postOutput.ref);
    if (!targetPostId) continue;

    const postAuthorId = targetPostAuthorByRef.get(postOutput.ref);
    const filteredEntries = postOutput.comments
      // eslint-disable-next-line max-params
      .map((comment, originalIndex) => ({ comment, originalIndex }))
      .filter(({ comment }) => {
        if (comment.author === postAuthorId) {
          logBatchInfo("comment_batch.self_reply_excluded", {
            communityId: community.id,
            postId: targetPostId,
          });
          return false;
        }
        return true;
      });

    filteredEntriesByRef.set(postOutput.ref, filteredEntries);
    totalCommentCount += filteredEntries.length;
  }

  // コメントに drip タイムスタンプを割り当てて永続化する。
  const dripTimestamps = assignDripTimestamps({
    slotAt: now,
    windowMs: dripWindowMs,
    count: totalCommentCount,
    rng,
  });

  const savedComments: CommentRecord[] = [];
  let dripIdx = 0;
  let commentSeq = 0;

  for (const postOutput of output.posts) {
    const targetPostId = postRefMap.get(postOutput.ref);
    if (!targetPostId) continue;

    const filteredEntries = filteredEntriesByRef.get(postOutput.ref) ?? [];
    if (filteredEntries.length === 0) continue;

    // 1st pass: parentCommentId=null で全コメントを作成。
    const commentInputs = filteredEntries.map(({ comment }) => {
      const createdAt = dripTimestamps[dripIdx] ?? new Date(now.getTime() + dripIdx * 1000);
      dripIdx++;
      return {
        postId: targetPostId,
        slotKey,
        seq: commentSeq++,
        author: comment.author,
        text: comment.text,
        createdAt,
        parentCommentId: null as string | null,
      };
    });

    const createdComments = await deps.commentRepo.createMany(community.id, commentInputs);
    savedComments.push(...createdComments);

    // 元のインデックス -> 作成済みコメントの対応表（reply_to 解決用）。
    const createdByOriginalIndex = new Map<number, CommentRecord>();
    // eslint-disable-next-line max-params
    filteredEntries.forEach(({ originalIndex }, newIdx) => {
      const created = createdComments[newIdx];
      if (created) createdByOriginalIndex.set(originalIndex, created);
    });

    // 2nd pass: reply_to が設定されているコメントの parentCommentId を解決。
    if (deps.commentRepo.updateParentCommentId) {
      for (const { comment: genComment, originalIndex } of filteredEntries) {
        const createdComment = createdByOriginalIndex.get(originalIndex);
        if (!createdComment) continue;

        const replyTo = genComment.reply_to ?? null;
        if (replyTo === null) continue;
        if (replyTo < 0 || replyTo >= postOutput.comments.length || replyTo === originalIndex) continue;

        const parentGenComment = postOutput.comments[replyTo];
        const parentCreated = createdByOriginalIndex.get(replyTo);
        if (!parentGenComment || !parentCreated) continue;

        // 親コメントと同一 author への reply_to はトップレベル化する（自己返信チェーン防止・#1069）。
        if (parentGenComment.author === genComment.author) continue;

        await deps.commentRepo.updateParentCommentId(createdComment.id, parentCreated.id);
        const idx = savedComments.findIndex((c) => c.id === createdComment.id);
        if (idx !== -1) {
          savedComments[idx] = { ...savedComments[idx]!, parentCommentId: parentCreated.id };
        }
      }
    }
  }

  // BatchRunLog と TokenUsageLog を記録する。
  const batchRunLog = await deps.batchRunLogRepository?.create({
    status: "success",
    messageCount: savedComments.length,
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

  return savedComments;
}

/**
 * comment 専用の定時バッチ本体（#673）。
 *
 * 1 日 4 回起動し、全コミュニティを Promise.allSettled で並列処理する（ADR-0033 踏襲）。
 * 直近3日の post を対象に vote 重み付きコメント数を生成し、3h 窓内に createdAt を分散させる。
 */
export async function runCommentBatch(deps: RunCommentBatchDeps): Promise<RunCommentBatchResult> {
  const apiKey = deps.anthropicApiKey;
  if (!apiKey) {
    logBatchInfo("comment_batch.skipped_no_api_key");
    return { comments: [] };
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const slotKey = deps.slotKey ?? new Date().toISOString();
  const rng = deps.rng ?? Math.random;
  const now = deps.now ?? new Date();
  const dripWindowMs = deps.dripWindowMs ?? DEFAULT_COMMENT_DRIP_WINDOW_MS;
  const revivalProbability = deps.revivalProbability ?? REVIVAL_PROBABILITY;

  const communities = (await deps.communityRepo.list()).filter((c) => !c.generationPaused);

  if (communities.length === 0) {
    return { comments: [] };
  }

  // botWorkerProvider を先に 1 回だけ呼び出す（N 重呼び出しを防ぐ）。
  const botWorkersPromise: Promise<readonly WorkerRecord[]> = deps.botWorkerProvider
    ? deps.botWorkerProvider()
    : Promise.resolve([]);

  // 全コミュニティを並列処理する（ADR-0033 踏襲）。
  const results = await Promise.allSettled(
    communities.map((community) =>
      processCommunityComments({
        community,
        deps,
        apiKey,
        generate,
        slotKey,
        rng,
        now,
        dripWindowMs,
        revivalProbability,
        botWorkersPromise,
      }),
    ),
  );

  const savedComments: CommentRecord[] = [];

  for (const [i, result] of results.entries()) {
    const community = communities[i]!;
    if (result.status === "fulfilled") {
      savedComments.push(...result.value);
    } else {
      const message = extractErrorMessage(result.reason);
      logBatchError("comment_batch.community_failed", result.reason, {
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
        logBatchError("comment_batch.failure_log_write_failed", logErr, {
          communityId: community.id,
        });
      }
    }
  }

  return { comments: savedComments };
}
