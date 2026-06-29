/** e2e テスト用コメント作成ヘルパー（Issue #897）。 */

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

interface CommentParams {
  postId: string;
  workerId: string;
  text: string;
  parentCommentId?: string;
}

interface Comment {
  id: string;
  text: string;
  delete: () => Promise<void>;
}

export async function createComment({ postId, workerId, text, parentCommentId }: CommentParams): Promise<Comment> {
  const res = await fetch(`${API_BASE}/api/admin/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, authorWorkerId: workerId, text, parentCommentId: parentCommentId ?? null }),
  });
  if (!res.ok) throw new Error(`createComment failed: ${res.status} ${await res.text()}`);
  const comment = (await res.json()) as { id: string; text: string };
  return {
    id: comment.id,
    text: comment.text,
    delete: async () => {
      const del = await fetch(`${API_BASE}/api/admin/comments/${comment.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error(`deleteComment failed: ${del.status}`);
    },
  };
}
