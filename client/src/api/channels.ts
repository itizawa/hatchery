import type { Channel, ChannelGoal, ChannelType, MessageRecord } from "@hatchery/common";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

export const CHANNELS_QUERY_KEY = ["channels"] as const;
export const channelMessagesQueryKey = (channelId: string) =>
  ["channels", channelId, "messages"] as const;

/**
 * GET /channels を openapi-fetch（生成型）経由で取得するフック（ADR-0006）。
 * サーバ状態は TanStack Query に集約する（ADR-0003）。
 * Suspense 対応: ローディング中は Promise を throw し、data は常に Channel[]（undefined なし）。
 */
export function useChannels() {
  return useSuspenseQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: async (): Promise<Channel[]> => {
      const { data, error } = await openApiClient.GET("/api/channels");
      if (error) throw new Error(JSON.stringify(error));
      return data ?? [];
    },
  });
}

/**
 * POST /channels でチャンネルを作成するミューテーションフック（認証必須・#47・#54）。
 * 成功後にチャンネル一覧キャッシュを無効化して再取得させる。
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; type?: ChannelType; goal?: ChannelGoal }): Promise<Channel> => {
      const { data, error } = await openApiClient.POST("/api/channels", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: input as any,
        credentials: "include",
      });
      if (error || !data) throw new Error(JSON.stringify(error));
      return data as Channel;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
  });
}

/**
 * GET /channels/{channelId}/messages でチャンネルのメッセージ一覧を取得するフック（#48）。
 * Suspense 対応: ローディング中は Promise を throw し、data は常に MessageRecord[]（undefined なし）。
 */
export function useChannelMessages(channelId: string) {
  return useSuspenseQuery({
    queryKey: channelMessagesQueryKey(channelId),
    queryFn: async (): Promise<MessageRecord[]> => {
      const { data, error } = await openApiClient.GET("/api/channels/{channelId}/messages", {
        params: { path: { channelId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return (data ?? []) as unknown as MessageRecord[];
    },
  });
}

/**
 * PATCH /channels/{id} でチャンネル名を更新するミューテーションフック（認証必須・#206）。
 * 成功後にチャンネル一覧キャッシュを無効化して再取得させる。
 */
export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; label: string }): Promise<Channel> => {
      const { data, error } = await openApiClient.PATCH("/api/channels/{id}", {
        params: { path: { id: input.id } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { label: input.label } as any,
        credentials: "include",
      });
      if (error || !data) throw new Error(JSON.stringify(error));
      return data as Channel;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
  });
}

/**
 * POST /channels/{channelId}/messages でメッセージを投稿するミューテーションフック（認証必須・#48）。
 * 成功後にそのチャンネルのメッセージキャッシュを無効化して再取得させる。
 */
export function usePostChannelMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string): Promise<MessageRecord> => {
      const { data, error } = await openApiClient.POST("/api/channels/{channelId}/messages", {
        params: { path: { channelId } },
        body: { text },
        credentials: "include",
      });
      if (error || !data) throw new Error(error ? JSON.stringify(error) : "no data returned");
      return data as unknown as MessageRecord;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: channelMessagesQueryKey(channelId) }),
  });
}
