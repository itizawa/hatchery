/**
 * 閲覧ビーコン API クライアント（#665 / ADR-0032）。
 * - POST /api/posts/{postId}/view … post 閲覧ビーコン（sendBeacon / fetch keepalive）
 * - POST /api/posts/{postId}/comment-views … コメント閲覧ビーコン（バッチ）
 *
 * fire-and-forget 用途のため、レスポンスボディは読まない。
 * navigator.sendBeacon は一部環境で利用できないため fetch(keepalive) にフォールバックする。
 */
import { useEffect, useRef, useCallback } from "react";

import { apiBaseUrl } from "./client.js";

// ─── セッション ID ────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY_SESSION_ID = "hatchery:sessionId";

/** ブラウザセッションごとに生成・キャッシュする UUID v4 相当の sessionId を返す。 */
function getOrCreateSessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY_SESSION_ID);
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY_SESSION_ID, id);
    return id;
  } catch {
    // sessionStorage 利用不可（プライベートモード等）の場合は都度生成する。
    return crypto.randomUUID();
  }
}

// ─── sendBeacon ヘルパー ──────────────────────────────────────────────────────

/**
 * sendBeacon でエンドポイントに JSON を送信する。
 * sendBeacon が使えない環境では fetch(keepalive) にフォールバックする。
 */
// eslint-disable-next-line max-params
function sendJsonBeacon(url: string, body: unknown): void {
  const json = JSON.stringify(body);
  const blob = new Blob([json], { type: "application/json" });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    // sendBeacon が false を返す（バジェット超過等）場合は fetch にフォールバックする。
    if (navigator.sendBeacon(url, blob)) return;
  }

  // フォールバック: keepalive fetch（ページアンロード時にも完結する）
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: true,
    credentials: "include",
  }).catch(() => {
    // fire-and-forget なので失敗は無視する
  });
}

// ─── post 閲覧ビーコン ────────────────────────────────────────────────────────

/** post 閲覧ビーコンを送信する（#665 / ADR-0032）。 */
export function sendPostViewBeacon(postId: string): void {
  const sessionId = getOrCreateSessionId();
  sendJsonBeacon(`${apiBaseUrl}/api/posts/${postId}/view`, { sessionId });
}

/**
 * マウント時に 1 回だけ post 閲覧ビーコンを送信するフック（#665 / ADR-0032）。
 * PostThreadScene で使う。
 */
export function usePostViewBeacon(postId: string): void {
  useEffect(() => {
    if (postId) sendPostViewBeacon(postId);
    // postId が変わったら（ルート遷移）再送信するため deps に含める。
  }, [postId]);
}

// ─── コメント閲覧ビーコン（IntersectionObserver + dwell）─────────────────────

const COMMENT_VIEW_SESSION_KEY_PREFIX = "hatchery:cv:";
const DWELL_MS = 1000;
const INTERSECTION_THRESHOLD = 0.5;

function getCommentViewKey(commentId: string): string {
  return `${COMMENT_VIEW_SESSION_KEY_PREFIX}${commentId}`;
}

function markCommentViewed(commentId: string): void {
  try {
    sessionStorage.setItem(getCommentViewKey(commentId), "1");
  } catch {
    /* ignore */
  }
}

function hasCommentBeenViewed(commentId: string): boolean {
  try {
    return sessionStorage.getItem(getCommentViewKey(commentId)) === "1";
  } catch {
    return false;
  }
}

/**
 * コメント閲覧ビーコンをバッチ送信する（#665 / ADR-0032）。
 * sessionStorage で既送済みのコメントを除外する。
 */
// eslint-disable-next-line max-params
export function sendCommentViewsBeacon(postId: string, commentIds: string[]): void {
  const unseen = commentIds.filter((id) => !hasCommentBeenViewed(id));
  if (unseen.length === 0) return;

  for (const id of unseen) markCommentViewed(id);

  const sessionId = getOrCreateSessionId();
  sendJsonBeacon(`${apiBaseUrl}/api/posts/${postId}/comment-views`, {
    sessionId,
    commentIds: unseen,
  });
}

/**
 * コメント IntersectionObserver + dwell(1s) + sessionStorage dedup + sendBeacon バッチ送信フック（#665）。
 *
 * 使い方:
 * ```tsx
 * const { commentRef } = useCommentImpressions(postId);
 * // CommentCard の root 要素に ref を渡す。data-comment-id 属性でコメント ID を識別する。
 * <div ref={commentRef(commentId)}>...</div>
 * ```
 */
export function useCommentImpressions(postId: string) {
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const flush = useCallback(
    (commentIds: string[]) => {
      if (commentIds.length > 0) sendCommentViewsBeacon(postId, commentIds);
    },
    [postId],
  );

  useEffect(() => {
    const pending = pendingRef.current;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const commentId = el.dataset.commentId;
          if (!commentId) continue;

          if (entry.isIntersecting) {
            if (!pending.has(commentId) && !hasCommentBeenViewed(commentId)) {
              const timer = setTimeout(() => {
                pending.delete(commentId);
                flush([commentId]);
              }, DWELL_MS);
              pending.set(commentId, timer);
            }
          } else {
            const timer = pending.get(commentId);
            if (timer !== undefined) {
              clearTimeout(timer);
              pending.delete(commentId);
            }
          }
        }
      },
      { threshold: INTERSECTION_THRESHOLD },
    );

    return () => {
      observerRef.current?.disconnect();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [flush]);

  /** コメント要素に渡す ref コールバック（data-comment-id 属性を設定しておくこと）。 */
  const commentRef = useCallback((commentId: string) => (el: HTMLElement | null) => {
    if (!observerRef.current) return;
    if (el) {
      el.dataset.commentId = commentId;
      observerRef.current.observe(el);
    }
  }, []);

  return { commentRef };
}
