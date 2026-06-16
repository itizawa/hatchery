import { QueryClient } from "@tanstack/react-query";

/**
 * アプリ用の QueryClient を生成する（ADR-0003: サーバ状態は TanStack Query に集約）。
 * テスト容易性のため毎回新しいインスタンスを返す（テスト間でキャッシュを共有しない）。
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
    },
  });
