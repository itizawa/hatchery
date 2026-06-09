import { z } from "zod";

/**
 * ワーカー間の関係値。ADR-0019。
 * 将来の进化イベント・関係値高度化（Phase 1）に対応する基盤。
 */
export const WorkerRelationSchema = z.object({
  targetWorkerId: z.string().min(1).max(100),
  value: z.number(),
});

export type WorkerRelation = z.infer<typeof WorkerRelationSchema>;

/**
 * 個々のワーカーの状態。ADR-0019。
 * community を横断するグローバルな状態（worker_states は community 横断 global）。
 * - mood: 現在の気分（Phase 1 で高度化予定）
 * - experience: 経験値（crowd-vote で増加）
 * - lastAppearedSlotKey: 最後に登場した定時キー
 * - relations: 他ワーカーとの関係値（Phase 1 で高度化予定）
 * - hasEvolved: 進化済みフラグ（Phase 1 の進化イベント）
 */
export const WorkerStateSchema = z.object({
  mood: z.string().max(100).optional(),
  experience: z.number().int().nonnegative().default(0),
  lastAppearedSlotKey: z.string().optional(),
  relations: z.array(WorkerRelationSchema).default([]),
  hasEvolved: z.boolean().default(false),
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
