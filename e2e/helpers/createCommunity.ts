/** e2e テスト用コミュニティ作成ヘルパー（Issue #897）。 */

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

interface CommunityParams {
  name: string;
  slug: string;
  description?: string;
  workerIds?: string[];
}

interface Community {
  id: string;
  slug: string;
  name: string;
  delete: () => Promise<void>;
}

export async function createCommunity({ name, slug, description = "", workerIds = [] }: CommunityParams): Promise<Community> {
  const res = await fetch(`${API_BASE}/api/admin/communities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, name, description }),
  });
  if (!res.ok) throw new Error(`createCommunity failed: ${res.status} ${await res.text()}`);
  const community = (await res.json()) as { id: string; slug: string; name: string };

  if (workerIds.length > 0) {
    const assign = await fetch(`${API_BASE}/api/admin/workers/${workerIds[0]}/communities`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityIds: [community.id] }),
    });
    if (!assign.ok) throw new Error(`assignWorkersToCommunity failed: ${assign.status}`);
  }

  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    delete: async () => {
      const del = await fetch(`${API_BASE}/api/admin/communities/${community.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error(`deleteCommunity failed: ${del.status}`);
    },
  };
}
