import type { CommunityRecord } from "../persistence/communityRepository.js";

/**
 * CommunityRecord（camelCase）を公開 API レスポンス（snake_case）に変換する（#310 / #477 / #457）。
 * `generationInstruction` は含めない（公開 API への漏洩防止・#488）。
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

/**
 * CommunityRecord（camelCase）を admin API レスポンスに変換する（#488）。
 * 公開レスポンスに加えて `generationInstruction` を含む。admin エンドポイントのみで使用する。
 */
export function toAdminCommunityResponse(r: CommunityRecord) {
  return {
    ...toCommunityResponse(r),
    generationInstruction: r.generationInstruction ?? null,
  };
}
