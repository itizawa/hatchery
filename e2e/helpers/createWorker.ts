/** e2e テスト用ワーカー作成ヘルパー（Issue #897）。 */

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

interface WorkerParams {
  display_name: string;
  bio?: string;
  image_url?: string | null;
}

interface Worker {
  id: string;
  display_name: string;
  bio: string | null;
  image_url: string | null;
  delete: () => Promise<void>;
}

export async function createWorker({ display_name, bio, image_url }: WorkerParams): Promise<Worker> {
  const res = await fetch(`${API_BASE}/api/admin/workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: display_name, bio }),
  });
  if (!res.ok) throw new Error(`createWorker failed: ${res.status} ${await res.text()}`);
  const worker = (await res.json()) as { id: string; displayName: string; bio: string | null; imageUrl: string | null };
  return {
    id: worker.id,
    display_name: worker.displayName,
    bio: worker.bio,
    image_url: worker.imageUrl ?? null,
    delete: async () => {
      const del = await fetch(`${API_BASE}/api/admin/workers/${worker.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error(`deleteWorker failed: ${del.status}`);
    },
  };
}
