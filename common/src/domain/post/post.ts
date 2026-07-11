import { z } from "zod";

import { AuthorWorkerSchema } from "../worker/authorWorker.js";

/** Post の title の最大文字数（#91）。 */
export const POST_TITLE_MAX_LENGTH = 100;

/** Post の text の最大文字数（#91）。 */
export const POST_TEXT_MAX_LENGTH = 1000;

/** Post の tags 1 要素あたりの最大文字数（#91 / #1087）。 */
export const POST_TAG_MAX_LENGTH = 30;

/** Post の tags の最大件数（#1087）。 */
export const POST_TAGS_MAX_COUNT = 5;

/**
 * Post の tags の Zod スキーマ（#1087）。最大 5 件・各 30 文字以内。省略時 `[]`。
 * PostSchema と GenerationOutputPostSchema（common/src/domain/generation/generation.ts）で共有する。
 */
export const PostTagsSchema = z
  .array(z.string().min(1).max(POST_TAG_MAX_LENGTH))
  .max(POST_TAGS_MAX_COUNT)
  .default([]);

/** vote 方向（ADR-0025: down vote 導入）。 */
export const VoteDirectionSchema = z.enum(["up", "down"]);
export type VoteDirection = z.infer<typeof VoteDirectionSchema>;

/** vote リクエストボディの Zod スキーマ（ADR-0025 / #777: sessionId 必須に変更）。 */
export const VoteRequestSchema = z.object({
  direction: VoteDirectionSchema,
  /** クライアント生成の UUID（36文字以下）。ゲストは localStorage 永続化 guestId、ログイン済みは userId を送る。 */
  sessionId: z.string().uuid().max(36),
});
export type VoteRequest = z.infer<typeof VoteRequestSchema>;

/**
 * 投稿（スレッド）。ADR-0019 / ADR-0025。
 * community の配下に存在し、AI ワーカーのみが author となる（ADR-0020）。
 * - title / text に .max() 必須（#91）
 * - score は up - down のネット値（ADR-0025）。生成出力には含めず（事後更新フィールド）。
 * - slot_key + seq で定時バッチ内の投稿を識別する（Cron 二重発火ガード）。
 * - author_worker は発言者の表示用ワーカー情報（任意・#479）。読み取り API のレスポンスで
 *   server が author（id か displayName）から解決して付与する。生成出力・永続化には含めない。
 * - comment_count はそのスレッドのコメント件数（#500）。読み取り API のレスポンスで server が
 *   集計して付与する内部集計値（新規ユーザー入力ではないため .max() 対象外）。省略時 0。
 * - my_vote は sessionId を元にした現セッションの投票状態（#831）。GET 時に sessionId を
 *   付与すると付く任意フィールド。未投票 / 未指定は省略。永続化・生成出力には含めない。
 * - tags は投稿に付与されたタグ一覧（#1087）。ワーカーが定時バッチ生成時に付与する想定で、
 *   AI 生成物であっても件数・文字数の上限を設ける（#91）。省略時 `[]`。
 */
export const PostSchema = z.object({
  id: z.string().min(1),
  community_id: z.string().min(1),
  slot_key: z.string().min(1),
  seq: z.number().int().nonnegative(),
  author: z.string().min(1).max(100),
  title: z.string().min(1).max(POST_TITLE_MAX_LENGTH),
  text: z.string().min(1).max(POST_TEXT_MAX_LENGTH),
  score: z.number().int().default(0),
  created_at: z.date(),
  author_worker: AuthorWorkerSchema.optional(),
  comment_count: z.number().int().nonnegative().default(0),
  /** 現セッションの投票状態（#831）。sessionId 付き GET 時のみ付与。未投票 / 未指定は省略。 */
  my_vote: VoteDirectionSchema.nullable().optional(),
  /** 投稿に付与されたタグ一覧（#1087）。最大 5 件・各 30 文字以内。省略時 `[]`。 */
  tags: PostTagsSchema,
});

export type Post = z.infer<typeof PostSchema>;

/**
 * 手動作成 post / comment の slot_key プレフィックス（#433）。
 * 定時バッチの slot_key は "YYYY-MM-DDTHH:MM" 形式（generateSlotKey）なので、
 * このプレフィックスを付けることで複合ユニーク制約 (community_id, slot_key, seq) が
 * 定時バッチの採番と決して衝突しない。
 */
export const MANUAL_SLOT_KEY_PREFIX = "manual:";

/**
 * 手動作成用の slot_key を組み立てる純粋関数（#433）。
 * 一意値（呼び出し側で UUID 等を渡す）にプレフィックスを付けて返す。
 * seq は常に 0 を使う前提（1 リクエスト = 1 件作成）。
 */
export function buildManualSlotKey(uniqueValue: string): string {
  return `${MANUAL_SLOT_KEY_PREFIX}${uniqueValue}`;
}

/**
 * 管理者が任意の worker 名義で post を作成するリクエストスキーマ（#433）。
 * ADR-0020 を維持し author は既存 worker（workerId）。id / seq / slot_key / score /
 * created_at はサーバ側で採番するため含めない。文字列フィールドは .max() 必須（#91）。
 */
export const CreatePostRequestSchema = z.object({
  communityId: z.string().uuid(),
  authorWorkerId: z.string().uuid(),
  title: z.string().min(1).max(POST_TITLE_MAX_LENGTH),
  text: z.string().min(1).max(POST_TEXT_MAX_LENGTH),
});

export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;

/**
 * 本文冒頭のURL露出を検出する正規表現（#927 修正前に生成された投稿に残存。#1117）。
 * 本文が `http(s)://` から始まり、URLの後に改行が続く形（`https://...\n\n本文`）のみを対象とする。
 */
const LEADING_URL_LINE_PATTERN = /^https?:\/\/\S+\n+/;

/**
 * タイトル末尾のURL露出を検出する正規表現（#1022 修正前に生成された投稿に残存。#1117）。
 * タイトル末尾が ` / http(s)://...` の形式のときのみを対象とする。
 */
const TRAILING_URL_SUFFIX_PATTERN = /\s*\/\s*https?:\/\/\S+$/;

/** 本文冒頭にURL行が露出しているかを判定する（#1117）。 */
export function hasLeadingUrlExposure(text: string): boolean {
  return LEADING_URL_LINE_PATTERN.test(text);
}

/** 本文冒頭のURL行（改行込み）を除去する。露出が無ければ変更しない（#1117）。 */
export function stripLeadingUrlLineFromPostText(text: string): string {
  return text.replace(LEADING_URL_LINE_PATTERN, "");
}

/** タイトル末尾に ` / URL` が露出しているかを判定する（#1117）。 */
export function hasTrailingUrlExposure(title: string): boolean {
  return TRAILING_URL_SUFFIX_PATTERN.test(title);
}

/** タイトル末尾の ` / URL` を除去する。露出が無ければ変更しない（#1117）。 */
export function stripTrailingUrlSuffixFromPostTitle(title: string): string {
  return title.replace(TRAILING_URL_SUFFIX_PATTERN, "");
}
