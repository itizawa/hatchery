import { test } from "../support/test.js";

/**
 * PWA e2e テスト（#797）。
 *
 * e2e/pwa/usecases.md の UC-PWA-01〜06 に対応するテストスケルトン。
 */

test.todo("UC-PWA-01: manifest リンクが HTML の <head> に存在し manifest.webmanifest を参照している");

test.todo(
  "UC-PWA-02: <meta name=\"theme-color\" content=\"#1164A3\"> が HTML の <head> に存在する",
);

test.todo(
  "UC-PWA-03: /manifest.webmanifest が正しい name / display / start_url / theme_color / icons を返す",
);

test.todo("UC-PWA-04: /pwa-192x192.png と /pwa-512x512.png が HTTP 200 で PNG 画像を返す");

test.todo(
  "UC-PWA-05: Service Worker が activated 状態になりオフラインでもアプリシェルが表示される",
);

test.todo("UC-PWA-06: インストールプロンプトが表示されスタンドアロンモードで起動できる");
