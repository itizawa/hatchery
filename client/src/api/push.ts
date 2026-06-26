import { ensureOk, openApiClient } from "./client.js";

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
  const result = await openApiClient.POST("/api/push-subscriptions", {
    credentials: "include",
    body: { endpoint, p256dh, auth },
  });
  ensureOk({ result, label: "POST /api/push-subscriptions" });
}

/** DELETE /api/push-subscriptions — Web Push 購読を削除する。 */
export async function unsubscribePush({ endpoint }: { endpoint: string }): Promise<void> {
  const result = await openApiClient.DELETE("/api/push-subscriptions", {
    credentials: "include",
    body: { endpoint },
  });
  ensureOk({ result, label: "DELETE /api/push-subscriptions" });
}
