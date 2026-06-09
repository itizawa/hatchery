import { z } from "zod";

import { COMMENT_TEXT_MAX_LENGTH } from "../comment/comment.js";
import { POST_TEXT_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from "../post/post.js";

/**
 * 生成出力のコメント部分スキーマ。ADR-0019。
 * - author は既知 workerId のみ（人間は出力に現れない・ADR-0020）
 * - score は含めない（事後更新フィールド・ADR-0019）
 */
export const GenerationOutputCommentSchema = z.object({
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
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
 * 生成出力のトップレベルスキーマ。ADR-0019。
 * `{ topic, posts: [{ id, author, title, text, comments: [{ author, text }] }] }`
 * - community は含めない（呼び出し側が保持）
 * - posts は 1 件以上必須
 */
export const GenerationOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(GenerationOutputPostSchema).min(1),
});

export type GenerationOutput = z.infer<typeof GenerationOutputSchema>;

/**
 * 生成出力の検証関数。ADR-0019 / ADR-0020。
 * - author が既知の workerId のみ含まれているか検証する
 * - 指定外の worker が出ていないかを登場制御（knownWorkerIds に含まれない author は reject）
 * - 人間ユーザーは出力に現れてはならない（ADR-0020）
 * - 不正があれば Error を投げる
 *
 * @param output 検証対象の生成出力（GenerationOutput 型）
 * @param knownWorkerIds 許可された workerId のリスト
 * @throws Error author が knownWorkerIds に含まれない場合
 */
export const validateGenerationOutput = (
  output: GenerationOutput,
  knownWorkerIds: readonly string[],
): void => {
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
};
