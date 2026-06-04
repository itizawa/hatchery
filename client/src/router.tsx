import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useLocation,
  type RouterHistory,
} from "@tanstack/react-router";
import type { ReactElement } from "react";

import { fetchMe } from "./api/auth.js";
import {
  SETTINGS_TAB_VALUES,
  type SettingsTabValue,
} from "./routes/settingsTabValues.js";

export { SETTINGS_TAB_VALUES, type SettingsTabValue } from "./routes/settingsTabValues.js";
import { AccountScene } from "./routes/AccountScene";
import { AuthLayout } from "./routes/AuthLayout";
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

/**
 * サイドバーなしで描画する auth ルートのパス一覧。
 * 新しい auth ルート（/signup 等）を追加した場合はここにも追記すること。
 */
const AUTH_PATHS = ["/login"] as const satisfies readonly string[];

/**
 * アプリ全体のシェル。現在のパスに応じて
 * - auth 系ルート（/login 等）→ AuthLayout（サイドバーなし）
 * - その他 → RootLayout（サイドバーあり）
 * を切り替える。ルートの ID を変えない方式のため、既存の useSearch 等への影響がない。
 */
function AppShell(): ReactElement {
  const { pathname } = useLocation();
  if (AUTH_PATHS.some((p) => p === pathname)) {
    return <AuthLayout />;
  }
  return <RootLayout />;
}

// ルートはコードベースで定義する（ファイルルーティングの codegen には依存しない）。
const rootRoute = createRootRoute({
  component: AppShell,
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

/** ログイン画面（/login）。サイドバーなしの AuthLayout 経由で描画する。 */
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
  validateSearch: (search: Record<string, unknown>): { tab: SettingsTabValue } => {
    const tab = search.tab;
    if (
      typeof tab === "string" &&
      (SETTINGS_TAB_VALUES as readonly string[]).includes(tab)
    ) {
      return { tab: tab as SettingsTabValue };
    }
    return { tab: "users" };
  },
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
