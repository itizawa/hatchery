import { useEffect } from "react";

import type { AppRouter } from "../router";
import { notifyCfPageView } from "./cfBeacon";

/**
 * TanStack Router のルート遷移（解決完了）を契機に Cloudflare ビーコンへ page ビューを通知する
 * （ADR-0026 / #439）。SPA は `<a>` のフルロードを伴わないため、初回ロード以外の各遷移ごとに
 * `notifyCfPageView()` を 1 回呼ぶ。
 *
 * - 初回ロードのページビューはビーコンスクリプト本体が自動計測するため、ここでは除外して二重計上を避ける。
 * - `window.__cfBeacon` 不在（トークン未設定）でも `notifyCfPageView` が no-op になるため安全。
 *
 * @param router 購読対象のアプリルータ（テストでは memory history のルータを注入する）。
 */
export function useCfPageViewTracking(router: AppRouter): void {
  useEffect(() => {
    // 最初の onResolved（初回ロード）を除外するためのフラグ。
    let isFirstResolve = true;
    const unsubscribe = router.subscribe("onResolved", () => {
      if (isFirstResolve) {
        isFirstResolve = false;
        return;
      }
      notifyCfPageView();
    });
    return unsubscribe;
  }, [router]);
}
