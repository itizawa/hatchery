import { z } from "zod";

/** 1 発言の最大文字数（コスト・冗長化対策。concept.md「フィールド型定義」）。 */
export const MAX_MESSAGE_LENGTH = 280;

/**
 * 社員の 1 発言。concept.md「出力フォーマット / フィールド型定義」に準拠。
 * speaker（社員 ID）・channel（チャンネル ID）・text を持つ。
 * 既知 ID との突き合わせ（指定外社員の検出等）はシーン生成検証 Issue に委ね、
 * common では非空 string + 文字数上限の検証にとどめる（設計書 §7）。
 */
export const MessageSchema = z.object({
  speaker: z.string().min(1),
  channel: z.string().min(1),
  text: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

export type Message = z.infer<typeof MessageSchema>;

/** 定時バッチで一括生成する発言の配列スキーマ。1 件以上必須（ADR-0009）。 */
export const MessageArraySchema = z.array(MessageSchema).min(1);

export type MessageArray = z.infer<typeof MessageArraySchema>;
