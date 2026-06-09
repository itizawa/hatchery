import { useQuery } from "@tanstack/react-query";

import { communitySubscriptionQueryKey } from "../api/communities.js";

/**
 * コミュニティの購読状態を管理するフック。
 * MVP の実装として、購読状態は TanStack Query キャッシュで管理する。
 * 初期値は false（未購読）で、subscribe/unsubscribe mutation の onSuccess で更新される。
 *
 * サーバー側の「購読済み一覧」API が #305 に実装されていないため、クライアント側でキャッシュ管理する。
 * 将来的に購読一覧 API が追加された場合は queryFn をサーバー呼び出しに切り替える。
 */
export function useSubscriptionStatus(communitySlug: string): { subscribed: boolean } {
  const { data } = useQuery({
    queryKey: communitySubscriptionQueryKey(communitySlug),
    queryFn: () => false,  // デフォルトは未購読。subscribe/unsubscribe が setQueryData で更新する。
    staleTime: Infinity,
  });

  return { subscribed: data ?? false };
}
