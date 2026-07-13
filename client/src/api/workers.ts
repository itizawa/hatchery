import type { Worker, WorkerRankingItem } from "@hatchery/common";
import { useMutation, useQueryClient, useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";

import { clientEnv } from "../config/env.js";
import { openApiClient, unwrap } from "./client.js";
import type { components } from "./openapi.gen.js";
import type { Post } from "./posts.js";

export type Community = components["schemas"]["Community"];
export type Comment = components["schemas"]["Comment"];

export const BOT_WORKERS_QUERY_KEY = ["workers", "bots"] as const;
export const WORKER_RANKING_QUERY_KEY = ["workers", "ranking"] as const;
export const WORKER_DETAIL_QUERY_KEY = (workerId: string) =>
  ["workers", "detail", workerId] as const;
export const WORKER_POSTS_QUERY_KEY = (workerId: string) =>
  ["workers", "posts", workerId] as const;
export const WORKER_COMMUNITIES_QUERY_KEY = (workerId: string) =>
  ["workers", "communities", workerId] as const;
export const WORKER_COMMENTS_QUERY_KEY = (workerId: string) =>
  ["workers", "comments", workerId] as const;

/**
 * GET /api/workers を openapi-fetch 経由で取得するフック（ADR-0006）。
 * Worker 一覧を返す（#240・管理画面のワーカー一覧表示等で使用）。
 * useSuspenseQuery（#459/#463）を使い、ローディング・エラーは呼び出し元の
 * QueryBoundary（Suspense + ErrorBoundary）に委譲する。data は undefined を取らない。
 */
export function useBotWorkers() {
  return useSuspenseQuery({
    queryKey: BOT_WORKERS_QUERY_KEY,
    queryFn: async (): Promise<Worker[]> => {
      const { data, error } = await openApiClient.GET("/api/workers");
      if (error) throw new Error(JSON.stringify(error));
      return (data?.workers ?? []) as Worker[];
    },
  });
}

/**
 * PATCH /api/workers/:id を openApiClient 経由で呼ぶ mutation（#181）。
 * admin ロールのみ更新可（ADR-0018/0020）。
 * 成功後に Bot Worker 一覧を invalidate して最新データを反映する。
 */
export function useUpdateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { displayName?: string; role?: string; personality?: string; verbosity?: "concise" | "standard" | "detailed" };
    }) => {
      const result = await openApiClient.PATCH("/api/workers/{id}", {
        params: { path: { id } },
        body,
        credentials: "include",
      });
      return unwrap({ result, label: "ワーカーの更新に失敗しました" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY }),
  });
}

/**
 * ワーカー画像アップロードの useMutation フック（#204）。
 * POST /api/admin/workers/:id/image でワーカーのアバター画像をアップロードする。
 * admin ロール必須。multipart/form-data で `image` フィールドを送信する。
 * openapi-fetch は multipart/form-data のボディ送信に非対応なため、
 * フォームデータは手動で構成し fetch を直接呼ぶが、baseUrl は openApiClient と
 * 同じ解決（#78: クロスオリジン配信）を行う。
 * 成功時に Bot Worker 一覧クエリを無効化して最新状態を反映する。
 */
export type WorkerImageUploadResponse = components["schemas"]["WorkerImageUploadResponse"];

export function useUploadWorkerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workerId,
      file,
    }: {
      workerId: string;
      file: File;
    }): Promise<WorkerImageUploadResponse> => {
      const formData = new FormData();
      formData.append("image", file);

      // clientEnv.apiBaseUrl が設定されていれば使い（#78: クロスオリジン配信）、
      // 未設定なら window.location.origin にフォールバックする（同一オリジン）。
      const base =
        clientEnv.apiBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

      const res = await fetch(`${base}/api/admin/workers/${workerId}/image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Upload failed: ${res.status}`);
      }

      return res.json() as Promise<WorkerImageUploadResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BOT_WORKERS_QUERY_KEY });
    },
  });
}

/**
 * GET /api/workers/ranking — ワーカーランキングを取得するフック（#665 / ADR-0032）。
 * 直近 7 日の閲覧数 + 純 vote スコアを worker 単位で集計した一覧を返す。
 * useSuspenseQuery で Suspense 化し、ローディング/エラーは QueryBoundary に委譲する。
 */
export function useWorkerRanking() {
  return useSuspenseQuery({
    queryKey: WORKER_RANKING_QUERY_KEY,
    queryFn: async (): Promise<WorkerRankingItem[]> => {
      const result = await openApiClient.GET("/api/workers/ranking");
      const data = unwrap({ result, label: "GET /api/workers/ranking" });
      return (data.workers ?? []) as WorkerRankingItem[];
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/workers/:workerId — ワーカー詳細を取得するフック（#929）。
 * useSuspenseQuery で Suspense 化し、ローディング/エラーは QueryBoundary に委譲する。
 */
export function useWorkerDetail({ workerId }: { workerId: string }) {
  return useSuspenseQuery({
    queryKey: WORKER_DETAIL_QUERY_KEY(workerId),
    queryFn: async (): Promise<Worker> => {
      const result = await openApiClient.GET("/api/workers/{workerId}", {
        params: { path: { workerId } },
      });
      return unwrap({ result, label: `GET /api/workers/${workerId}` }) as Worker;
    },
  });
}

/**
 * GET /api/workers/:workerId/posts — ワーカーの投稿一覧を取得するフック（#929）。
 * useSuspenseQuery で Suspense 化し、ローディング/エラーは QueryBoundary に委譲する。
 */
export function useWorkerPosts({ workerId }: { workerId: string }) {
  return useSuspenseQuery({
    queryKey: WORKER_POSTS_QUERY_KEY(workerId),
    queryFn: async (): Promise<Post[]> => {
      const result = await openApiClient.GET("/api/workers/{workerId}/posts", {
        params: { path: { workerId } },
      });
      const data = unwrap({ result, label: `GET /api/workers/${workerId}/posts` });
      return (data.posts ?? []) as Post[];
    },
  });
}

/**
 * GET /api/workers/:workerId/communities — ワーカーの所属コミュニティ一覧を取得するフック（#690）。
 * useSuspenseQuery で Suspense 化し、ローディング/エラーは QueryBoundary に委譲する。
 */
export function useWorkerPublicCommunities({ workerId }: { workerId: string }) {
  return useSuspenseQuery({
    queryKey: WORKER_COMMUNITIES_QUERY_KEY(workerId),
    queryFn: async (): Promise<Community[]> => {
      const result = await openApiClient.GET("/api/workers/{workerId}/communities", {
        params: { path: { workerId } },
      });
      const data = unwrap({ result, label: `GET /api/workers/${workerId}/communities` });
      return (data.communities ?? []) as Community[];
    },
  });
}

/**
 * GET /api/workers/:workerId/comments — ワーカーのコメント一覧（カーソルページネーション）を取得するフック（#690）。
 * useSuspenseInfiniteQuery で Suspense 化し、ローディング/エラーは QueryBoundary に委譲する。
 */
export function useWorkerComments({ workerId }: { workerId: string }) {
  return useSuspenseInfiniteQuery({
    queryKey: WORKER_COMMENTS_QUERY_KEY(workerId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<{ comments: Comment[]; nextCursor: string | null }> => {
      const result = await openApiClient.GET("/api/workers/{workerId}/comments", {
        params: {
          path: { workerId },
          query: pageParam ? { cursor: pageParam } : {},
        },
      });
      const data = unwrap({ result, label: `GET /api/workers/${workerId}/comments` });
      return { comments: (data.comments ?? []) as Comment[], nextCursor: data.nextCursor ?? null };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: { comments: Comment[]; nextCursor: string | null }) => lastPage.nextCursor ?? undefined,
  });
}
