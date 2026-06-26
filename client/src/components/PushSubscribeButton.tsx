import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import { type ReactElement, useCallback, useEffect, useState } from "react";

import { Box, Button, Typography } from "./uiParts/index.js";

import { subscribePush, unsubscribePush } from "../api/push.js";
import { clientEnv } from "../config/env.js";

/** Web Push 購読の状態 */
type PushState = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** urlBase64 → Uint8Array（VAPID 公開鍵の変換）。 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Web Push 購読ボタン（#798）。
 * - VAPID 公開鍵（VITE_VAPID_PUBLIC_KEY）未設定の場合は非表示。
 * - iOS Safari では PushManager が HTTPS + PWA（ホーム画面追加）のみでサポートされる。
 *   対応外のブラウザでは「非対応」メッセージを表示する。
 * - 権限拒否（denied）の場合はブラウザ設定への誘導メッセージを表示する。
 */
export function PushSubscribeButton(): ReactElement | null {
  const { vapidPublicKey } = clientEnv;
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey) {
      setState("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setState("unsubscribed"));
  }, [vapidPublicKey]);

  const handleSubscribe = useCallback(async () => {
    if (!vapidPublicKey) return;
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      await subscribePush({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setState("subscribed");
    } catch (err) {
      if (Notification.permission === "denied") {
        setState("denied");
      } else {
        setError(err instanceof Error ? err.message : "購読登録に失敗しました");
      }
    }
  }, [vapidPublicKey]);

  const handleUnsubscribe = useCallback(async () => {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // ブラウザ側を先に解除してから サーバ記録を削除する。
        // 逆順にすると sub.unsubscribe() 失敗時にサーバ記録だけ消えて永続的な不整合が起きる。
        await sub.unsubscribe();
        await unsubscribePush({ endpoint: sub.endpoint });
      }
      setState("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "購読解除に失敗しました");
    }
  }, []);

  if (!vapidPublicKey || state === "unsupported") return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        プッシュ通知
      </Typography>

      {state === "denied" && (
        <Typography variant="body2" color="error">
          通知がブロックされています。ブラウザの設定から通知を許可してください。
        </Typography>
      )}

      {state !== "denied" && state !== "loading" && (
        <Button
          variant="outlined"
          size="small"
          startIcon={
            state === "subscribed" ? <NotificationsOffRounded /> : <NotificationsActiveRounded />
          }
          onClick={state === "subscribed" ? () => void handleUnsubscribe() : () => void handleSubscribe()}
          sx={{ mt: 0.5 }}
        >
          {state === "subscribed" ? "通知をオフにする" : "新着通知を受け取る"}
        </Button>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
