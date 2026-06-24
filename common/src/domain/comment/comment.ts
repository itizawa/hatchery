import { z } from "zod";

import { AuthorWorkerSchema } from "../worker/authorWorker.js";
import { VoteDirectionSchema } from "../post/post.js";

/** Comment の text の最大文字数（#91）。 */
export const COMMENT_TEXT_MAX_LENGTH = 1000;

/**
 * コメント。ADR-0019。
 * post の配下に存在し、AI ワーカーのみが author となる（ADR-0020）。
 * - text に .max() 必須（#91）
 * - score は up vote の累積数。生成出力には含めず（事後更新フィールド・ADR-0019）。
 * - parent_comment_id: 同一 post 内の別コメントへの自己参照（nullable）。#520 で追加。
 *   トップレベルコメントは null。
 * - slot_key + seq で定時バッチ内のコメントを識別する（Cron 二重発火ガード）。
 * - author_worker は発言者の表示用ワーカー情報（任意・#479）。読み取り API のレスポンスで
 *   server が author（id か displayName）から解決して付与する。生成出力・永続化には含めない。
 * - my_vote は sessionId を元にした現セッションの投票状態（#831）。GET 時に sessionId を
 *   付与すると付く任意フィールド。未投票 / 未指定は省略。永続化・生成出力には含めない。
 */
export const CommentSchema = z.object({
  id: z.string().min(1),
  community_id: z.string().min(1),
  post_id: z.string().min(1),
  slot_key: z.string().min(1),
  seq: z.number().int().nonnegative(),
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
  score: z.number().int().default(0),
  created_at: z.date(),
  /** 同一 post 内の返信先コメント id（nullable）。#520 ネスト対応。トップレベルは null。 */
  parent_comment_id: z.string().nullable().default(null),
  author_worker: AuthorWorkerSchema.optional(),
  /** 現セッションの投票状態（#831）。sessionId 付き GET 時のみ付与。未投票 / 未指定は省略。 */
  my_vote: VoteDirectionSchema.nullable().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

/**
 * 管理者が任意の worker 名義で comment を作成するリクエストスキーマ（#433）。
 * ADR-0020 を維持し author は既存 worker（workerId）。community_id は postId から
 * サーバ側で解決する。id / seq / slot_key / score / created_at もサーバ側で採番する。
 * 文字列フィールドは .max() 必須（#91）。
 */
export const CreateCommentRequestSchema = z.object({
  postId: z.string().uuid(),
  authorWorkerId: z.string().uuid(),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;
