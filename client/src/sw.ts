/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

// registerType: "autoUpdate" 相当: 即座にアクティベートしてクライアントを制御する。
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// プレキャッシュ設定 & 古いキャッシュ削除。
// vite-plugin-pwa の injectManifest が `self.__WB_MANIFEST` をマニフェスト配列に置換する。
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA: ナビゲーションは index.html にフォールバック。
// /api/* と /health は SW を素通りさせる（キャッシュしない）。
registerRoute(
  new NavigationRoute(
    async () => {
      const cached = await matchPrecache("/index.html");
      return cached ?? Response.error();
    },
    { denylist: [/^\/api\//, /^\/health/] },
  ),
);

// Web Push イベント（#798）。
self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = (event.data?.json() ?? {}) as typeof payload;
  } catch {
    payload = { title: "Hatchery", body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Hatchery";
  const options: NotificationOptions = {
    body: payload.body || "新しいコンテンツがあります",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップで指定 URL を開く（#798）。
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const path: string = (event.notification.data as { url?: string }).url ?? "/";
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === path && "focus" in c);
      if (existing) {
        return (existing as WindowClient).focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
