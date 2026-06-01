import { z } from "zod";

/** MVP のチャンネル ID（#雑談 / #仕事）。既知 ID 群との突き合わせに用いる。 */
export const CHANNEL_IDS = ["zatsudan", "shigoto"] as const;

export type ChannelId = (typeof CHANNEL_IDS)[number];

/** 話題の入れ物。id（チャンネル ID）と表示ラベルを持つ。 */
export const ChannelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type Channel = z.infer<typeof ChannelSchema>;

/**
 * 既定チャンネルの定義（seed の単一情報源・#47）。
 * チャンネル一覧は DB から `GET /channels` で取得する方式へ移行したため、これは
 * client 実行時の描画ソースではなく、開発用 seed（server/prisma/seedDevData）・
 * インメモリ実装・バッチ既定の初期値としてのみ用いる。CHANNEL_IDS と 1 対 1 に対応する。
 */
export const DEFAULT_CHANNELS: readonly Channel[] = [
  { id: "zatsudan", label: "#雑談" },
  { id: "shigoto", label: "#仕事" },
];

/**
 * チャンネル ID から既定チャンネル（DEFAULT_CHANNELS）の Channel を引く。
 * 未知 ID は undefined を返す（フォールバック表示など UI 側の方針は呼び出し側に委ねる）。
 * DEFAULT_CHANNELS の正本（common）に解決ロジックを集約する（ADR-0005）。
 */
export const findChannelById = (channelId: string): Channel | undefined =>
  DEFAULT_CHANNELS.find((channel) => channel.id === channelId);

/** チャンネル名更新リクエストのボディ検証スキーマ（PATCH /channels/:id）。 */
export const UpdateChannelSchema = z.object({
  label: z.string().min(1),
});

export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;

/** チャンネル作成リクエストのボディ検証スキーマ（POST /channels・#47）。id はサーバが採番する。 */
export const CreateChannelSchema = z.object({
  label: z.string().min(1),
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
