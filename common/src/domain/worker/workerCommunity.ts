import { z } from "zod";

/**
 * ワーカーの参加コミュニティ編集（#490）用 Zod スキーマ。
 * admin が `WorkerCommunity`（worker ↔ community 参加テーブル・#489）の紐づきを
 * 管理画面から編集する際のリクエスト/レスポンス形を common の単一情報源として定義する。
 */

/** 1 ワーカーが参加できる community 数の上限（#490）。表示・DB 負荷を考慮した安全上限。 */
export const WORKER_COMMUNITIES_MAX = 100;

/** communityId 文字列の最大長（#91 に倣い `.max()` を付与）。uuid7（36 文字）を十分に収める。 */
export const WORKER_COMMUNITY_ID_MAX_LENGTH = 64;

/**
 * ワーカーの参加コミュニティ id 集合。
 * - GET レスポンス（現在の参加 community id 配列）
 * - PUT リクエスト/レスポンス（置き換える community id 配列）
 * の両方で使う共通形。
 */
export const WorkerCommunityIdsSchema = z.object({
  communityIds: z
    .array(z.string().min(1).max(WORKER_COMMUNITY_ID_MAX_LENGTH))
    .max(WORKER_COMMUNITIES_MAX),
});

export type WorkerCommunityIds = z.infer<typeof WorkerCommunityIdsSchema>;

/**
 * ワーカーの参加コミュニティを置き換える（set）リクエストボディ（#490）。
 * 形は WorkerCommunityIdsSchema と同一。意味付けのため別名でエクスポートする。
 */
export const SetWorkerCommunitiesSchema = WorkerCommunityIdsSchema;

export type SetWorkerCommunitiesInput = z.infer<typeof SetWorkerCommunitiesSchema>;
