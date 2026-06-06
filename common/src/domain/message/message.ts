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

/** ユーザーがチャンネルへメッセージを投稿するリクエストボディ（#48）。speaker/channel はサーバ側でセット。 */
export const CreateChannelMessageSchema = z.object({
  text: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

export type CreateChannelMessage = z.infer<typeof CreateChannelMessageSchema>;

/**
 * 永続化された 1 発言（#40）。生成ペイロード MessageSchema に、永続化由来の
 * id / createdAt / order を加えたもの。common を単一情報源とし、server の
 * MessageRecord はこの型から導出する（ADR-0005）。
 * order は定時バッチ内での発言順（0 始まり、ADR-0009）。
 * 注: id を必須にするのは「永続化形」のみ。生成入力（MessageSchema / MessageArraySchema）には
 * id を含めない（AI 生成・リクエスト検証・OpenAPI を壊さないため）。
 * proposalTitle / proposalReason / proposalTargetUrl / issueNumber / issueUrl は
 * #企画 チャンネルの UX 提案メッセージ用 optional フィールド（#76）。
 */
export const MessageRecordSchema = MessageSchema.extend({
  id: z.string().min(1),
  createdAt: z.date(),
  order: z.number().int().nonnegative(),
  proposalTitle: z.string().optional(),
  proposalReason: z.string().optional(),
  proposalTargetUrl: z.string().optional(),
  issueNumber: z.number().int().positive().optional(),
  issueUrl: z.string().optional(),
});

export type MessageRecord = z.infer<typeof MessageRecordSchema>;
