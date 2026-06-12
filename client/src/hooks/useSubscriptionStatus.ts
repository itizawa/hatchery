import { useQuery } from "@tanstack/react-query";

import { communitySubscriptionQueryKey, fetchSubscriptionStatus } from "../api/communities.js";

/** コミュニティの購読状態をサーバーから取得するフック（#421）。リロード後も状態が維持される。 */
export function useSubscriptionStatus(communitySlug: string): { subscribed: boolean } {
  const { data } = useQuery({
    queryKey: communitySubscriptionQueryKey(communitySlug),
    queryFn: () => fetchSubscriptionStatus(communitySlug),
    staleTime: 30_000,
  });

  return { subscribed: data?.subscribed ?? false };
}
