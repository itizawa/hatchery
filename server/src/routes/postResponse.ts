import type { AuthorWorker } from "@hatchery/common";

import type { CommentRecord } from "../persistence/commentRepository.js";
import type { PostRecord } from "../persistence/postRepository.js";

/**
 * Post / Comment レコード（Prisma 由来の camelCase）を OpenAPI 契約
 * （`PostSchema` / `CommentSchema`・snake_case）のレスポンス形に整形する（#499）。
 *
 * 正本は OpenAPI/Zod スキーマ（`community_id` / `slot_key` / `post_id` / `created_at`）。
 * サーバが Prisma レコードをそのまま返すと camelCase になり契約と食い違うため
 * （ADR-0006 違反）、`toCommunityResponse` と同じ整形パターンでここに集約する。
 *
 * `author_worker` は #479 の enrich 結果に含まれる任意フィールド。整形は enrich の
 * 後段で行い、存在する場合のみ透過する（解決できない author は付与しない）。
 */

/** PostRecord に author_worker（任意）と commentCount（任意）を付けた enrich 後の形。 */
type EnrichedPostRecord = PostRecord & { author_worker?: AuthorWorker; commentCount?: number };

/** CommentRecord に author_worker（任意）を付けた enrich 後の形。 */
type EnrichedCommentRecord = CommentRecord & { author_worker?: AuthorWorker };

/** Post レスポンス（OpenAPI `PostSchema` と一致するフィールド名）。 */
export function toPostResponse(r: EnrichedPostRecord) {
  const base = {
    id: r.id,
    community_id: r.communityId,
    slot_key: r.slotKey,
    seq: r.seq,
    author: r.author,
    title: r.title,
    text: r.text,
    score: r.score,
    created_at: r.createdAt,
    // コメント件数（#500）。enrich されていない場合は 0 を返す。
    comment_count: r.commentCount ?? 0,
  };
  return r.author_worker ? { ...base, author_worker: r.author_worker } : base;
}

/** Comment レスポンス（OpenAPI `CommentSchema` と一致するフィールド名）。 */
export function toCommentResponse(r: EnrichedCommentRecord) {
  const base = {
    id: r.id,
    community_id: r.communityId,
    post_id: r.postId,
    slot_key: r.slotKey,
    seq: r.seq,
    author: r.author,
    text: r.text,
    score: r.score,
    created_at: r.createdAt,
  };
  return r.author_worker ? { ...base, author_worker: r.author_worker } : base;
}
