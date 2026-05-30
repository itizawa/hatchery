import { useQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

/** /scenes GET を TanStack Query で呼ぶフック（ADR-0006: openapi-fetch + TanStack Query）。 */
export function useScenes() {
  return useQuery({
    queryKey: ["scenes"],
    queryFn: async () => {
      const { data, error } = await openApiClient.GET("/scenes");
      if (error) throw new Error(JSON.stringify(error));
      return data ?? [];
    },
  });
}
