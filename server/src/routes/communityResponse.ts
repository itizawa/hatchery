import type { CommunityRecord } from "../persistence/communityRepository.js";

/**
 * CommunityRecord（camelCase）を OpenAPI 契約の Community レスポンス（snake_case）に変換する。
 * admin / 公開ルート双方でこの整形を共有し、クライアントが受け取るフィールド名を契約に揃える（#310 / #477 / #457）。
 * - createdAt → created_at
 * - synopsis / lastSlotKey の null は undefined（任意フィールド）に正規化する
 * - iconUrl / coverUrl は null をそのまま返す（未設定を契約上の null として表現する・#457）
 */
export function toCommunityResponse(r: CommunityRecord) {
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
  };
}
