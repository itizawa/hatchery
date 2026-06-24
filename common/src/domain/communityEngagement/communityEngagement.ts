import { z } from "zod";

/** community 別 vote 集計エントリ */
export const CommunityVoteEntrySchema = z.object({
  communityId: z.string().max(100),
  count: z.number().int().nonnegative(),
  sharePercent: z.number(),
});
export type CommunityVoteEntry = z.infer<typeof CommunityVoteEntrySchema>;

/** worker 別 vote 集計エントリ */
export const WorkerVoteEntrySchema = z.object({
  workerId: z.string().max(100),
  count: z.number().int().nonnegative(),
  sharePercent: z.number(),
});
export type WorkerVoteEntry = z.infer<typeof WorkerVoteEntrySchema>;

/** GET /api/admin/community-engagement のレスポンススキーマ（#761）。 */
export const CommunityEngagementSchema = z.object({
  /** 集計ウィンドウ（日数） */
  windowDays: z.number().int().positive(),
  /** コミュニティ別 vote 集計（count 降順） */
  communityVotes: z.array(CommunityVoteEntrySchema),
  /** ワーカー別 vote 集計（count 降順） */
  workerVotes: z.array(WorkerVoteEntrySchema),
  /** 独占的ロイヤリティスコア（0–1）：ユーザーが最も多く投票した community の vote シェア平均 */
  loyaltyScore: z.number().min(0).max(1),
  /** コミュニティ別購読者数（communityId → count） */
  subscriberCountByCommunity: z.record(z.number().int().nonnegative()),
});
export type CommunityEngagement = z.infer<typeof CommunityEngagementSchema>;
