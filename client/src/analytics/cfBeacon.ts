/**
 * Cloudflare Web Analytics ビーコン連携（ADR-0026 / #439）。
 *
 * ビーコンスクリプト（`beacon.min.js`）は読み込まれると `window.__cfBeacon` に
 * `push` を持つキューを生やす。SPA のルート遷移は `<a>` のフルロードを伴わないため、
 * ルータのナビゲーション契機で `window.__cfBeacon.push({ type: "page" })` を手動で呼び、
 * page ビューとして計測させる。
 *
 * トークン未設定（ローカル / テスト / トークン未発行）ではビーコンが読み込まれず
 * `window.__cfBeacon` が存在しないため、通知は no-op になる（例外を投げない）。
 */

/** Cloudflare ビーコンが受け付けるイベント。SPA の page ビュー通知に用いる。 */
interface CfBeaconEvent {
  type: "page";
}

/** ビーコンスクリプトが生やす `window.__cfBeacon` のキュー型（push のみ利用する）。 */
interface CfBeaconQueue {
  push: (event: CfBeaconEvent) => void;
}

declare global {
  interface Window {
    __cfBeacon?: CfBeaconQueue;
  }
}

/**
 * Cloudflare ビーコンへ SPA の page ビューを 1 回通知する。
 * `window.__cfBeacon`（または push）が無い場合は何もしない（no-op・例外を投げない）。
 */
export function notifyCfPageView(): void {
  const beacon = window.__cfBeacon;
  if (!beacon || typeof beacon.push !== "function") return;
  beacon.push({ type: "page" });
}
