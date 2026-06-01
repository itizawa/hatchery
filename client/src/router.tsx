import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";

import { fetchMe } from "./api/auth.js";
import { AccountScene } from "./routes/AccountScene";
import { ChannelScene } from "./routes/ChannelScene";
import { HomeScene } from "./routes/HomeScene";
import { LoginScene } from "./routes/LoginScene";
import { RootLayout } from "./routes/RootLayout";
import { SettingsScene } from "./routes/SettingsScene";

/**
 * 認証ガード: 未ログイン（fetchMe が null を返す）またはネットワークエラーの場合に /login へリダイレクト。
 * adminRoute・accountRoute の beforeLoad で共有する。
 */
async function requireAuth(): Promise<void> {
  let user: Awaited<ReturnType<typeof fetchMe>>;
  try {
    user = await fetchMe();
  } catch {
    throw redirect({ to: "/login" });
  }
  if (!user) throw redirect({ to: "/login" });
}

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
  component: ChannelScene,
});

/** ログイン画面（/login）。 */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginScene,
});

/** 管理画面（/admin）。未ログインまたはネットワークエラーの場合は /login へリダイレクト。 */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: SettingsScene,
  beforeLoad: requireAuth,
});

/** アカウント設定画面（/account）。未ログインまたはネットワークエラーの場合は /login へリダイレクト。 */
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountScene,
  beforeLoad: requireAuth,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  channelRoute,
  loginRoute,
  adminRoute,
  accountRoute,
]);

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

/** アプリのルータ型（AppRoot への注入や Register augmentation で共有する）。 */
export type AppRouter = ReturnType<typeof createAppRouter>;

/** SPA 実行時に用いる既定ルータ（browser history）。 */
export const router: AppRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
