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

/** MVP の既定チャンネル定義。CHANNEL_IDS と 1 対 1 に対応する。 */
export const DEFAULT_CHANNELS: readonly Channel[] = [
  { id: "zatsudan", label: "#雑談" },
  { id: "shigoto", label: "#仕事" },
];
