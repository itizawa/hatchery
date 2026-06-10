import {
  DEFAULT_WORKERS,
  GenerationOutputSchema,
  formatRecentLog,
  type RecentEntry,
  validateGenerationOutput,
} from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { CommentRecord, CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRecord, PostRepository } from "../persistence/postRepository.js";
import { getApiKey } from "../utils/apiKey.js";

import { generateConversationWithClaude, type ConversationGenerator } from "./aiMessageGenerator.js";
import { buildCommunityPrompt, type WorkerDef } from "./buildCommunityPrompt.js";

/** プロンプトに載せる直近 post/comment の既定件数。 */
const DEFAULT_RECENT_LIMIT = 30;

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
  /** バッチ実行ログの永続化（省略時はログ保存しない）。 */
  batchRunLogRepository?: BatchRunLogRepository;
  /** テスト用に注入可能な AI 生成関数。省略時は Claude を使う。 */
  generate?: ConversationGenerator;
  /** プロンプトに載せる直近 post/comment 件数（既定 30）。 */
  recentLimit?: number;
  /** ワーカー定義（省略時は DEFAULT_WORKERS）。 */
  workers?: readonly WorkerDef[];
  /**
   * 定時キー（省略時は現在時刻から "YYYY-MM-DDTHH:MM" 形式を自動生成）。
   * テストで固定 slotKey を使う場合に注入する。
   */
  slotKey?: string;
}

/**
 * 現在時刻から slot_key を生成する（"YYYY-MM-DDTHH:MM" 形式・ローカル時刻基準）。
 * Cron 二重発火ガードに使う。
 */
export function generateSlotKey(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * community 単位の定時バッチ本体（#306 / ADR-0019 / ADR-0020 / ADR-0009）。
 *
 * 全 community を取得し、community ごとに:
 * 1. 直近 post/comment ログ（formatRecentLog）を組み立て
 * 2. community の description + worker 定義 + 直近ログでプロンプト構築
 * 3. 1 API コールで生成（{ topic, posts: [...] } の JSON）
 * 4. common の GenerationOutputSchema + validateGenerationOutput で検証
 * 5. 検証を通った post/comment を (community_id, slot_key, seq) 複合ユニーク制約で永続化
 *
 * エラーハンドリング:
 * - API キー未設定 → 何も生成せず空を返す（スキップ）。
 * - JSON パース失敗 → その community をスキップし次の community へ。
 * - author 検証失敗 → その community をスキップし次の community へ。
 * - score は生成出力に含まれていても無視する（永続化時に 0 固定・ADR-0019）。
 */
export async function runCommunityBatch(
  deps: RunCommunityBatchDeps,
): Promise<RunCommunityBatchResult> {
  const apiKey = await getApiKey(deps.appSettingRepo);
  if (!apiKey) {
    console.error("[communityBatch] API キーが設定されていないためスキップします");
    return { posts: [], comments: [] };
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const recentLimit = deps.recentLimit ?? DEFAULT_RECENT_LIMIT;
  const workers = deps.workers ?? (DEFAULT_WORKERS as WorkerDef[]);
  const slotKey = deps.slotKey ?? generateSlotKey();
  const workerIds = workers.map((w) => w.id);

  const communities = await deps.communityRepo.list();

  const savedPosts: PostRecord[] = [];
  const savedComments: CommentRecord[] = [];
  const errors: string[] = [];

  for (const community of communities) {
    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[communityBatch] community ${community.id} の処理に失敗しました:`,
        err,
      );
      errors.push(`${community.id}: ${message}`);
    }
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
