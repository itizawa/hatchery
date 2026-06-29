/** e2e テスト用 post 作成ヘルパー（Issue #897）。 */

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

interface PostParams {
  communityId: string;
  workerId: string;
  title: string;
  content: string;
}

interface Post {
  id: string;
  title: string;
  delete: () => Promise<void>;
}

export async function createPost({ communityId, workerId, title, content }: PostParams): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/admin/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ communityId, authorWorkerId: workerId, title, text: content }),
  });
  if (!res.ok) throw new Error(`createPost failed: ${res.status} ${await res.text()}`);
  const post = (await res.json()) as { id: string; title: string };
  return {
    id: post.id,
    title: post.title,
    delete: async () => {
      const del = await fetch(`${API_BASE}/api/admin/posts/${post.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error(`deletePost failed: ${del.status}`);
    },
  };
}
