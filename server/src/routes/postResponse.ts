import type { PostRecord } from "../persistence/postRepository.js";
import type { CommentRecord } from "../persistence/commentRepository.js";
import type { VoteDirection } from "../persistence/voteRepository.js";

/** post レスポンスに付与する発言者ワーカー情報（#479）。 */
export interface AuthorWorker {
  id: string;
  display_name: string;
  image_url: string | null;
}

/**
 * toPostResponse に渡す拡張 PostRecord。
 * author_worker・commentCount・myVote はサーバ側で解決して付与するフィールド。
 */
type EnrichedPostRecord = PostRecord & {
  author_worker?: AuthorWorker;
  commentCount?: number;
  myVote?: VoteDirection | null;
};

/**
 * toCommentResponse に渡す拡張 CommentRecord。
 * author_worker・myVote はサーバ側で解決して付与するフィールド。
 */
type EnrichedCommentRecord = CommentRecord & {
  author_worker?: AuthorWorker;
  myVote?: VoteDirection | null;
};

/** PostRecord を API レスポンス形式に変換する。 */
export function toPostResponse(r: EnrichedPostRecord) {
  return {
    id: r.id,
    community_id: r.communityId,
    slot_key: r.slotKey,
    seq: r.seq,
    author: r.author,
    title: r.title,
    text: r.text,
    score: r.score,
    up_count: r.upCount,
    created_at: r.createdAt.toISOString(),
    ...(r.author_worker ? { author_worker: r.author_worker } : {}),
    comment_count: r.commentCount ?? 0,
    ...(r.myVote != null ? { my_vote: r.myVote } : {}),
  };
}

/** CommentRecord を API レスポンス形式に変換する。 */
export function toCommentResponse(r: EnrichedCommentRecord) {
  return {
    id: r.id,
    community_id: r.communityId,
    post_id: r.postId,
    slot_key: r.slotKey,
    seq: r.seq,
    author: r.author,
    text: r.text,
    score: r.score,
    up_count: r.upCount,
    created_at: r.createdAt.toISOString(),
    parent_comment_id: r.parentCommentId ?? null,
    ...(r.author_worker ? { author_worker: r.author_worker } : {}),
    ...(r.myVote != null ? { my_vote: r.myVote } : {}),
  };
}
