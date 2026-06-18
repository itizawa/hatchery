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

export function createApiClient(baseUrl: string, adminToken: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    listWorkers: () => call<unknown>("GET", "/api/workers"),

    createWorker: (data: { displayName: string; role?: string; personality?: string }) =>
      call<Worker>("POST", "/api/admin/workers", data),

    updateWorker: (id: string, data: { displayName?: string; role?: string; personality?: string }) =>
      call<Worker>("PATCH", `/api/workers/${id}`, data),

    listCommunities: () => call<unknown>("GET", "/api/admin/communities"),

    createCommunity: (data: {
      slug: string;
      name: string;
      description: string;
      generationInstruction?: string;
    }) => call<Community>("POST", "/api/admin/communities", data),

    updateCommunity: (
      id: string,
      data: { name?: string; description?: string; generationInstruction?: string | null },
    ) => call<Community>("PATCH", `/api/admin/communities/${id}`, data),

    assignWorkerToCommunity: (workerId: string, communityIds: string[]) =>
      call<{ communityIds: string[] }>("PUT", `/api/admin/workers/${workerId}/communities`, {
        communityIds,
      }),
  };
}
