import { useQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

/** /messages GET を TanStack Query で呼ぶフック（ADR-0006: openapi-fetch + TanStack Query）。 */
export function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await openApiClient.GET("/api/messages");
      if (error) throw new Error(JSON.stringify(error));
      return data ?? [];
    },
  });
}
