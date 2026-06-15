import { useQuery } from "@tanstack/react-query";

import { openApiClient } from "./client.js";

/**
 * OGP メタデータの型（openapi.gen.ts から引いた型を利用しやすい形に整理）。
 */
export interface OgpMeta {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
}

/**
 * 指定 URL の OGP メタデータを GET /api/ogp 経由で取得する（#515）。
 */
export async function fetchOgp(url: string): Promise<OgpMeta> {
  const result = await openApiClient.GET("/api/ogp", {
    params: { query: { url } },
  });
  if (result.error || !result.response.ok) {
    return { title: null, description: null, image: null, site_name: null };
  }
  return (result.data ?? { title: null, description: null, image: null, site_name: null }) as OgpMeta;
}

/**
 * TanStack Query で OGP メタデータを取得する hook（#515）。
 * url が null の場合はフェッチしない。
 */
export function useOgp(url: string | null) {
  return useQuery({
    queryKey: ["ogp", url],
    queryFn: () => fetchOgp(url!),
    enabled: url != null,
    staleTime: 5 * 60 * 1000, // 5 分間キャッシュ
    retry: false, // OGP 取得失敗は再試行しない
  });
}
