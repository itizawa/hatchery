import type { CommunityPostStats } from "../persistence/postRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";

/**
 * CommunityRecord（camelCase）を公開 API レスポンス（snake_case）に変換する（#310 / #477 / #457）。
 * `generationInstruction` は含めない（公開 API への漏洩防止・#488）。
 * - createdAt → created_at
 * - synopsis / lastSlotKey の null は undefined（任意フィールド）に正規化する
 * - iconUrl / coverUrl は null をそのまま返す（未設定を契約上の null として表現する・#457）
 * - post_count / last_post_at は stats から付与する（#527）
 * - subscriber_count は一括集計した購読者数から付与する（#930）
 */
// eslint-disable-next-line max-params
export function toCommunityResponse(
  r: CommunityRecord,
  stats?: CommunityPostStats,
  subscriberCount = 0,
) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    synopsis: r.synopsis ?? undefined,
    last_slot_key: r.lastSlotKey ?? undefined,
    iconUrl: r.iconUrl ?? null,
    coverUrl: r.coverUrl ?? null,
    created_at: r.createdAt,
    post_count: stats?.postCount ?? 0,
    last_post_at: stats?.lastPostAt?.toISOString() ?? null,
    subscriber_count: subscriberCount,
  };
}

/**
 * CommunityRecord（camelCase）を admin API レスポンスに変換する（#488 / #491）。
 * 公開レスポンスに加えて `generationInstruction` と `feedUrl` を含む。admin エンドポイントのみで使用する。
 */
export function toAdminCommunityResponse(r: CommunityRecord) {
  return {
    ...toCommunityResponse(r),
    generationInstruction: r.generationInstruction ?? null,
    feedUrl: r.feedUrl ?? null,
  };
}
