/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

// vite-plugin-pwa が injectManifest 時に注入するプレキャッシュマニフェスト（型宣言が必要）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __WB_MANIFEST: any[];

// プレキャッシュ設定 & 古いキャッシュ削除。
precacheAndRoute(__WB_MANIFEST);
cleanupOutdatedCaches();

// /api/* と /health はキャッシュしない（ネットワーク直接）。
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/health"),
  new NetworkFirst(),
);

// SPA: それ以外のナビゲーションは index.html にフォールバック。
// matchPrecache は Workbox 内部のバージョン付きキャッシュ名を解決するため
// ハードコードした文字列は使わない。
registerRoute(
  new NavigationRoute(async () => {
    const cached = await matchPrecache("/index.html");
    return cached ?? Response.error();
  }),
);

// Web Push イベント（#798）。
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: "Hatchery", body: event.data.text() };
  }

  const title = payload.title ?? "Hatchery";
  const options: NotificationOptions = {
    body: payload.body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップで指定 URL を開く（#798）。
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string }).url ?? "/";

  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === absoluteUrl && "focus" in c);
      if (existing) {
        return (existing as WindowClient).focus();
      }
      return self.clients.openWindow(absoluteUrl);
    }),
  );
});
