export interface Worker {
  id: string;
  displayName: string;
  role?: string;
  personality?: string;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  generationInstruction?: string | null;
}

export function createApiClient({ baseUrl, adminToken }: { baseUrl: string; adminToken: string }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  async function call<T>({ method, path, body }: { method: string; path: string; body?: unknown }): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
  }

  return {
    listWorkers: () => call<unknown>({ method: "GET", path: "/api/workers" }),

    createWorker: (data: { displayName: string; role?: string; personality?: string; verbosity?: "concise" | "standard" | "detailed" }) =>
      call<Worker>({ method: "POST", path: "/api/admin/workers", body: data }),

    updateWorker: ({ id, data }: { id: string; data: { displayName?: string; role?: string; personality?: string; verbosity?: "concise" | "standard" | "detailed" } }) =>
      call<Worker>({ method: "PATCH", path: `/api/workers/${id}`, body: data }),

    listCommunities: () => call<unknown>({ method: "GET", path: "/api/admin/communities" }),

    createCommunity: (data: {
      slug: string;
      name: string;
      description: string;
      generationInstruction?: string;
    }) => call<Community>({ method: "POST", path: "/api/admin/communities", body: data }),

    updateCommunity: ({ id, data }: {
      id: string;
      data: { name?: string; description?: string; generationInstruction?: string | null };
    }) => call<Community>({ method: "PATCH", path: `/api/admin/communities/${id}`, body: data }),

    assignWorkerToCommunity: ({ workerId, communityIds }: { workerId: string; communityIds: string[] }) =>
      call<{ communityIds: string[] }>({ method: "PUT", path: `/api/admin/workers/${workerId}/communities`, body: { communityIds } }),
  };
}
