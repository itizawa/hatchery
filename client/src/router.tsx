import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";

import { HomeScene } from "./routes/HomeScene";
import { RootLayout } from "./routes/RootLayout";

// ルートはコードベースで定義する（ファイルルーティングの codegen には依存しない）。
const rootRoute = createRootRoute({
  component: RootLayout,
});

/** ホーム（/）= 本日のシーン表示の枠。 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScene,
});

/** チャンネル別ビューの枠（/channels/$channelId）。本実装は MVP 機能 Issue で行う。 */
const channelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/channels/$channelId",
  component: HomeScene,
});

const routeTree = rootRoute.addChildren([indexRoute, channelRoute]);

export interface CreateAppRouterOptions {
  /** テストで memory history を差し込むための任意 history（未指定なら browser history）。 */
  history?: RouterHistory;
}

/**
 * アプリのルータを生成する。history を差し替え可能にしてテスト（memory history）から利用する。
 */
export const createAppRouter = (options: CreateAppRouterOptions = {}) =>
  createRouter({
    routeTree,
    history: options.history,
    defaultPreload: "intent",
  });

/** SPA 実行時に用いる既定ルータ（browser history）。 */
export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
