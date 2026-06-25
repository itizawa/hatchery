/**
 * Web Push 購読 API クライアント（#798）。
 * - POST   /api/push-subscriptions … 購読登録（upsert）
 * - DELETE /api/push-subscriptions … 購読削除
 *
 * 注: openapi.gen.ts はビルド前に再生成されるため、
 * ここでは fetch を直接使い型安全な openApiClient の利用は生成後のビルドに委ねる。
 */

/** POST /api/push-subscriptions — Web Push 購読を登録する（upsert）。 */
export async function subscribePush({
  endpoint,
  p256dh,
  auth,
}: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const res = await fetch("/api/push-subscriptions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, p256dh, auth }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `POST /api/push-subscriptions failed: ${res.status}`);
  }
}

/** DELETE /api/push-subscriptions — Web Push 購読を削除する。 */
export async function unsubscribePush({ endpoint }: { endpoint: string }): Promise<void> {
  const res = await fetch("/api/push-subscriptions", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `DELETE /api/push-subscriptions failed: ${res.status}`);
  }
}
