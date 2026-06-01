import type { Channel } from "@hatchery/common";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const CHANNELS_QUERY_KEY = ["channels"] as const;

/**
 * GET /channels を openapi-fetch（生成型）経由で取得するフック（ADR-0006）。
 * サーバ状態は TanStack Query に集約する（ADR-0003）。
 */
export function useChannels() {
  return useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: async (): Promise<Channel[]> => {
      const { data, error } = await openApiClient.GET("/channels");
      if (error) throw new Error(JSON.stringify(error));
      return data ?? [];
    },
  });
}

/**
 * POST /channels でチャンネルを作成するミューテーションフック（認証必須・#47）。
 * 成功後にチャンネル一覧キャッシュを無効化して再取得させる。
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (label: string): Promise<Channel> => {
      const { data, error } = await openApiClient.POST("/channels", {
        body: { label },
        credentials: "include",
      });
      if (error || !data) throw new Error(JSON.stringify(error));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
  });
}
