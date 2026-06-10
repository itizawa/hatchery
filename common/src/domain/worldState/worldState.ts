import { z } from "zod";

/**
 * 個々のワーカーの状態。ADR-0019 / ADR-0023。
 * community を横断するグローバルな状態（worker_states は community 横断 global）。
 * 成長メカニクス系のフィールドは ADR-0023 で廃止済み。
 * 登場ローテーション制御に必要な lastAppearedSlotKey のみを保持する。
 * - lastAppearedSlotKey: 最後に登場した定時キー
 */
export const WorkerStateSchema = z.object({
  lastAppearedSlotKey: z.string().optional(),
});

export type WorkerState = z.infer<typeof WorkerStateSchema>;

/**
 * ワールド状態（グローバルシングルトン）。ADR-0019。
 * - summaryVersion: あらすじのバージョン番号（更新トラッキング用）
 * - workerStates: ワーカーID → 状態のマップ（community 横断 global）
 * - open_prompts は持たない（お題廃止・ADR-0020）
 * - synopsis は持たない（Community 側に持つ・ADR-0019）
 */
export const WorldStateSchema = z.object({
  summaryVersion: z.number().int().nonnegative().default(0),
  workerStates: z.record(z.string(), WorkerStateSchema).default({}),
});

export type WorldState = z.infer<typeof WorldStateSchema>;
