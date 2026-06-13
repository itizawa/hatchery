import type { ReactElement, ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { communitySubscriptionQueryKey, fetchSubscriptionStatus } from "../api/communities.js";

export interface SubscriptionStatusProps {
  /** 購読状態を取得するコミュニティの slug。空文字のときは取得せず subscribed=false を返す。 */
  communitySlug: string;
  /** 購読状態（subscribed）を受け取って描画する render-prop。 */
  children: (subscribed: boolean) => ReactNode;
}

/**
 * 購読状態（subscribed）を Suspense クエリで取得する内部コンポーネント（#461）。
 *
 * `useSuspenseQuery` は `enabled`/`skipToken` による条件付き無効化ができないため、
 * 「communitySlug が空のときは取得しない」を満たすには、slug が非空のときだけ
 * この子コンポーネントをマウントする（条件付き子コンポーネント分割）。
 */
function SubscriptionStatusQuery({
  communitySlug,
  children,
}: SubscriptionStatusProps): ReactElement {
  const { data } = useSuspenseQuery({
    queryKey: communitySubscriptionQueryKey(communitySlug),
    queryFn: () => fetchSubscriptionStatus(communitySlug),
    staleTime: 30_000,
  });

  return <>{children(data.subscribed)}</>;
}

/**
 * コミュニティの購読状態（subscribed）を Suspense で解決して render-prop に渡す（#421 / #461）。
 *
 * `useSuspenseQuery` は条件付き無効化（enabled/skipToken）に対応しないため、
 * `communitySlug` が空のときはクエリを発行せず即座に `children(false)` を描画し、
 * 非空のときだけ実際に Suspense クエリを行う内部コンポーネントをマウントする。
 * ローディングは呼び出し側を包む Suspense（QueryBoundary）に委譲する。
 */
export function SubscriptionStatus({
  communitySlug,
  children,
}: SubscriptionStatusProps): ReactElement {
  if (!communitySlug) {
    return <>{children(false)}</>;
  }
  return (
    <SubscriptionStatusQuery communitySlug={communitySlug}>{children}</SubscriptionStatusQuery>
  );
}
