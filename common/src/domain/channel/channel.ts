import { z } from "zod";

/** MVP のチャンネル ID（雑談 / 仕事 / 企画）。既知 ID 群との突き合わせに用いる。 */
export const CHANNEL_IDS = ["zatsudan", "shigoto", "kikaku"] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

/** チャンネルのタイプ（#54 / #76）。zatsudan=雑談 / task=仕事 / planning=企画。 */
export const ChannelTypeSchema = z.enum(["zatsudan", "task", "planning"]);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

/** チャンネル名（label）の最大文字数（#91）。スキーマと UI で共有する単一情報源。 */
export const CHANNEL_LABEL_MAX_LENGTH = 50;

/** 話題の入れ物。id（チャンネル ID）・表示ラベル・タイプを持つ。 */
export const ChannelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(CHANNEL_LABEL_MAX_LENGTH),
  type: ChannelTypeSchema,
});

export type Channel = z.infer<typeof ChannelSchema>;

/**
 * 既定チャンネルの定義（seed の単一情報源・#47）。
 * チャンネル一覧は DB から `GET /channels` で取得する方式へ移行したため、これは
 * client 実行時の描画ソースではなく、開発用 seed（server/prisma/seedDevData）・
 * インメモリ実装・バッチ既定の初期値としてのみ用いる。CHANNEL_IDS と 1 対 1 に対応する。
 */
export const DEFAULT_CHANNELS: readonly Channel[] = [
  { id: "zatsudan", label: "雑談", type: "zatsudan" },
  { id: "shigoto", label: "仕事", type: "task" },
  { id: "kikaku", label: "企画", type: "planning" },
];

/**
 * チャンネル ID から既定チャンネル（DEFAULT_CHANNELS）の Channel を引く。
 * 未知 ID は undefined を返す（フォールバック表示など UI 側の方針は呼び出し側に委ねる）。
 * DEFAULT_CHANNELS の正本（common）に解決ロジックを集約する（ADR-0005）。
 */
export const findChannelById = (channelId: string): Channel | undefined =>
  DEFAULT_CHANNELS.find((channel) => channel.id === channelId);

/** チャンネル更新リクエストのボディ検証スキーマ（PATCH /channels/:id・#54）。
 * label / type のどちらか一方は必須。 */
export const UpdateChannelSchema = z
  .object({
    label: z.string().min(1).max(CHANNEL_LABEL_MAX_LENGTH).optional(),
    type: ChannelTypeSchema.optional(),
  })
  .refine((data) => data.label !== undefined || data.type !== undefined, {
    message: "label または type のいずれかを指定してください",
  });

export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;

/** チャンネル作成リクエストのボディ検証スキーマ（POST /channels・#47・#54）。type 省略時は zatsudan。 */
export const CreateChannelSchema = z.object({
  label: z.string().min(1).max(CHANNEL_LABEL_MAX_LENGTH),
  type: ChannelTypeSchema.optional().default("zatsudan"),
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
