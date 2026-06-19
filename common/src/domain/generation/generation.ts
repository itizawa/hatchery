import { z } from "zod";

import { COMMENT_TEXT_MAX_LENGTH } from "../comment/comment.js";
import { POST_TEXT_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from "../post/post.js";

/**
 * 生成出力のコメント部分スキーマ。ADR-0019。
 * - author は既知 workerId のみ（人間は出力に現れない・ADR-0020）
 * - score は含めない（事後更新フィールド・ADR-0019）
 * - reply_to: 出力内の別コメントへの返信インデックス（0始まり・nullable）。#520。
 *   出力全体のコメントを順番に並べた際の 0 始まりインデックスで返信先を指定する。
 *   永続化時に実際のコメント id へ解決する。解決できない場合はトップレベル扱い（null）。
 */
export const GenerationOutputCommentSchema = z.object({
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
  /** 出力内コメントの 0 始まりインデックス（返信先）。null / 省略 = トップレベル。 */
  reply_to: z.number().int().nonnegative().nullable().optional(),
});

export type GenerationOutputComment = z.infer<typeof GenerationOutputCommentSchema>;

/**
 * 生成出力の投稿部分スキーマ。ADR-0019。
 * - author は既知 workerId のみ（人間は出力に現れない・ADR-0020）
 * - score は含めない（事後更新フィールド・ADR-0019）
 * - community は含めない（呼び出し側が保持）
 */
export const GenerationOutputPostSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1).max(100),
  title: z.string().min(1).max(POST_TITLE_MAX_LENGTH),
  text: z.string().min(1).max(POST_TEXT_MAX_LENGTH),
  comments: z.array(GenerationOutputCommentSchema).default([]),
});

export type GenerationOutputPost = z.infer<typeof GenerationOutputPostSchema>;

/**
 * 生成出力の既存Post宛Replyスキーマ。#555。
 * - targetPostRef: プロンプトに提示した既存Post参照ID（"ref-1" 等）
 * - author は既知 workerId のみ（人間は出力に現れない・ADR-0020）
 * - text に .max() 必須（#91）
 */
export const GenerationOutputReplySchema = z.object({
  targetPostRef: z.string().min(1).max(50),
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
});

export type GenerationOutputReply = z.infer<typeof GenerationOutputReplySchema>;

/**
 * 生成出力のトップレベルスキーマ。ADR-0019 / #555。
 * `{ topic, posts: [{ id, author, title, text, comments: [{ author, text }] }], replies: [{ targetPostRef, author, text }] }`
 * - community は含めない（呼び出し側が保持）
 * - posts は 1 件以上必須
 * - replies は省略可能（既存Post宛コメント追加・#555）
 */
export const GenerationOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(GenerationOutputPostSchema).min(1),
  replies: z.array(GenerationOutputReplySchema).default([]),
});

export type GenerationOutput = z.infer<typeof GenerationOutputSchema>;

/**
 * comment バッチ用: 既存 post への comment 追加出力スキーマ（#673）。
 * ref は postRefMap 経由で実際の postId に変換される。
 */
export const CommentBatchPostOutputSchema = z.object({
  ref: z.string().min(1).max(50),
  comments: z.array(GenerationOutputCommentSchema),
});

export type CommentBatchPostOutput = z.infer<typeof CommentBatchPostOutputSchema>;

/**
 * comment バッチのトップレベル出力スキーマ（#673）。
 * GenerationOutputSchema とは別に定義（posts.min(1) は新規 post 作成用・#673 は既存 post へのコメント追加）。
 */
export const CommentBatchOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(CommentBatchPostOutputSchema).min(1),
});

export type CommentBatchOutput = z.infer<typeof CommentBatchOutputSchema>;

/**
 * 生成出力の検証関数。ADR-0019 / ADR-0020 / #555。
 * - author が既知の workerId のみ含まれているか検証する
 * - 指定外の worker が出ていないかを登場制御（knownWorkerIds に含まれない author は reject）
 * - 人間ユーザーは出力に現れてはならない（ADR-0020）
 * - replies が含まれる場合（#555）:
 *   - reply の author が既知 workerId であること
 *   - knownPostRefs が渡された場合: reply の targetPostRef が knownPostRefs に含まれること
 * - 不正があれば Error を投げる
 *
 * @param output 検証対象の生成出力（GenerationOutput 型）
 * @param knownWorkerIds 許可された workerId のリスト
 * @param knownPostRefs プロンプトに提示した既存Post参照ID集合（省略時は targetPostRef 検証をスキップ）
 * @throws Error author が knownWorkerIds に含まれない場合、または targetPostRef が knownPostRefs に含まれない場合
 */
export const validateGenerationOutput = ({
  output,
  knownWorkerIds,
  knownPostRefs,
}: {
  output: GenerationOutput;
  knownWorkerIds: readonly string[];
  knownPostRefs?: ReadonlySet<string> | readonly string[];
}): void => {
  const known = new Set(knownWorkerIds);

  for (const post of output.posts) {
    if (!known.has(post.author)) {
      throw new Error(
        `生成出力の検証エラー: post の author "${post.author}" は既知の workerId ではありません。` +
          `許可された workerId: [${[...known].join(", ")}]`,
      );
    }

    for (const comment of post.comments) {
      if (!known.has(comment.author)) {
        throw new Error(
          `生成出力の検証エラー: comment の author "${comment.author}" は既知の workerId ではありません。` +
            `許可された workerId: [${[...known].join(", ")}]`,
        );
      }
    }
  }

  // replies の検証（#555）
  if (output.replies && output.replies.length > 0) {
    const postRefs = knownPostRefs instanceof Set ? knownPostRefs : new Set(knownPostRefs ?? []);

    for (const reply of output.replies) {
      if (!known.has(reply.author)) {
        throw new Error(
          `生成出力の検証エラー: reply の author "${reply.author}" は既知の workerId ではありません。` +
            `許可された workerId: [${[...known].join(", ")}]`,
        );
      }

      if (knownPostRefs !== undefined && !postRefs.has(reply.targetPostRef)) {
        throw new Error(
          `生成出力の検証エラー: reply の targetPostRef "${reply.targetPostRef}" はプロンプトに提示した参照ID集合に含まれていません。` +
            `許可された参照ID: [${[...postRefs].join(", ")}]`,
        );
      }
    }
  }
};
