import { z } from "zod";

/** Web Push API の購読情報（PushSubscription.toJSON() の shape）。 */
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(128),
});

export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

/** push 通知ペイロード（SW の showNotification に渡す情報）。 */
export const PushPayloadSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  url: z.string().max(512),
});

export type PushPayload = z.infer<typeof PushPayloadSchema>;

/** POST /api/push-subscriptions のリクエストボディ（PushSubscriptionSchema と同一）。 */
export const SubscribePushBodySchema = PushSubscriptionSchema;

export type SubscribePushBody = z.infer<typeof SubscribePushBodySchema>;

/** DELETE /api/push/subscribe のリクエストボディ。 */
export const UnsubscribePushBodySchema = z.object({
  endpoint: z.string().url().max(2048),
});

export type UnsubscribePushBody = z.infer<typeof UnsubscribePushBodySchema>;
