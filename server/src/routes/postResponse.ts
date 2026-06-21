import type { AuthorWorker } from "@hatchery/common";

import type { CommentRecord } from "../persistence/commentRepository.js";
import type { PostRecord } from "../persistence/postRepository.js";
import type { VoteDirection } from "../persistence/voteRepository.js";

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
 * `my_vote` は #831 の sessionId 付き GET 時に付与するフィールド（#831）。
 */

/** PostRecord に author_worker（任意）・commentCount（任意）・myVote（任意）を付けた enrich 後の形。 */
type EnrichedPostRecord = PostRecord & {
  author_worker?: AuthorWorker;
  commentCount?: number;
  myVote?: VoteDirection | null;
};

/** CommentRecord に author_worker（任意）・myVote（任意）を付けた enrich 後の形。 */
type EnrichedCommentRecord = CommentRecord & {
  author_worker?: AuthorWorker;
  myVote?: VoteDirection | null;
};

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
    // up vote 累計件数（#814）。
    up_count: r.upCount,
  };
  return {
    ...base,
    ...(r.author_worker ? { author_worker: r.author_worker } : {}),
    ...(r.myVote != null ? { my_vote: r.myVote } : {}),
  };
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
    parent_comment_id: r.parentCommentId ?? null,
    // up vote 累計件数（#814）。
    up_count: r.upCount,
  };
  return {
    ...base,
    ...(r.author_worker ? { author_worker: r.author_worker } : {}),
    ...(r.myVote != null ? { my_vote: r.myVote } : {}),
  };
}
