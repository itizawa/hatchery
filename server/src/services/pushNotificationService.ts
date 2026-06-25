import webpush from "web-push";

import { logBatchError } from "../batch/logger.js";
import type { PushSubscriptionRepository } from "../persistence/pushSubscriptionRepository.js";
import type { PushPayload } from "@hatchery/common";

export interface PushNotificationConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushNotificationService {
  sendToAllSubscribers(payload: PushPayload): Promise<void>;
}

/** web-push VAPID 送信サービス。失敗は握りつぶして全体を継続する（fire-and-forget）。 */
export function createPushNotificationService({
  config,
  pushSubscriptionRepo,
}: {
  config: PushNotificationConfig;
  pushSubscriptionRepo: PushSubscriptionRepository;
}): PushNotificationService {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return {
    async sendToAllSubscribers(payload: PushPayload): Promise<void> {
      const subs = await pushSubscriptionRepo.listAll();
      if (subs.length === 0) return;

      const body = JSON.stringify(payload);

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              body,
            );
          } catch (err: unknown) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 410 || status === 404) {
              // 失効した購読を削除する。
              await pushSubscriptionRepo.delete(sub.endpoint);
            } else if (status === 401 || status === 403) {
              // VAPID 認証エラー: キー設定ミスの可能性が高いため専用キーで記録する。
              logBatchError("push_notification.vapid_auth_failed", err, { endpoint: sub.endpoint });
            } else {
              logBatchError("push_notification.send_failed", err, { endpoint: sub.endpoint });
            }
          }
        }),
      );
    },
  };
}
