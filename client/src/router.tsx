import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useLocation,
  type RouterHistory,
} from "@tanstack/react-router";
import { isAdmin } from "@hatchery/common";
import { Suspense, type ReactElement } from "react";

import { fetchMe } from "./api/auth.js";
import {
  SETTINGS_TAB_VALUES,
  type SettingsTabValue,
} from "./routes/settingsTabValues.js";

export { SETTINGS_TAB_VALUES, type SettingsTabValue } from "./routes/settingsTabValues.js";
import { AuthLayout } from "./routes/AuthLayout";
import { RootLayout } from "./routes/RootLayout";
import { ChannelViewSkeleton } from "./components/ChannelViewSkeleton";

// ルートコンポーネントを lazyRouteComponent で動的 import（コード分割）する。
// TanStack Router の defaultPreload: "intent" と組み合わせ、ホバー時にプリロードされる。
const LazyHomeScene = lazyRouteComponent(() => import("./routes/HomeScene"), "HomeScene");
const LazyChannelScene = lazyRouteComponent(() => import("./routes/ChannelScene"), "ChannelScene");
const LazyLoginScene = lazyRouteComponent(() => import("./routes/LoginScene"), "LoginScene");
const LazySettingsScene = lazyRouteComponent(() => import("./routes/SettingsScene"), "SettingsScene");
const LazyAccountScene = lazyRouteComponent(() => import("./routes/AccountScene"), "AccountScene");
const LazyOfficeScene = lazyRouteComponent(() => import("./routes/OfficeScene"), "OfficeScene");
const LazyAcceptInvitationScene = lazyRouteComponent(
  () => import("./routes/AcceptInvitationScene"),
  "AcceptInvitationScene",
);

/**
 * 認証ガード: 未ログイン（fetchMe が null を返す）またはネットワークエラーの場合に /login へリダイレクト。
 * accountRoute の beforeLoad で使う。
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
 * admin ロール専用ガード（#136）: 未ログインなら /login、非 admin なら / へリダイレクト。
 * adminRoute の beforeLoad で使う。
 */
async function requireAdminRoute(): Promise<void> {
  let user: Awaited<ReturnType<typeof fetchMe>>;
  try {
    user = await fetchMe();
  } catch {
    throw redirect({ to: "/login" });
  }
  if (!user) throw redirect({ to: "/login" });
  if (!isAdmin(user)) throw redirect({ to: "/" });
}

/**
 * サイドバーなしで描画する auth 系ルートかどうかを判定する。
 * /login は完全一致、/invite/ は動的パスのためプレフィックス一致で判定する。
 * 新しい auth ルートを追加した場合はここにも追記すること。
 */
function isAuthLayout(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/invite/");
}

/**
 * アプリ全体のシェル。現在のパスに応じて
 * - auth 系ルート（/login, /invite/:token 等）→ AuthLayout（サイドバーなし）
 * - その他 → RootLayout（サイドバーあり）
 * を切り替える。ルートの ID を変えない方式のため、既存の useSearch 等への影響がない。
 */
function AppShell(): ReactElement {
  const { pathname } = useLocation();
  if (isAuthLayout(pathname)) {
    return <AuthLayout />;
  }
  return <RootLayout />;
}

// ルートはコードベースで定義する（ファイルルーティングの codegen には依存しない）。
const rootRoute = createRootRoute({
  component: AppShell,
});

/** ホーム（/）= 本日のシーン表示の枠。未ログインまたはネットワークエラーの場合は /login へリダイレクト。 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={null}>
      <LazyHomeScene />
    </Suspense>
  ),
  beforeLoad: requireAuth,
});

/** チャンネル別ビューの枠（/channels/$channelId）。未認証ユーザーも閲覧可能（#255）。 */
const channelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/channels/$channelId",
  component: () => (
    <Suspense fallback={<ChannelViewSkeleton />}>
      <LazyChannelScene />
    </Suspense>
  ),
});

/** ログイン画面（/login）。サイドバーなしの AuthLayout 経由で描画する。 */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => (
    <Suspense fallback={null}>
      <LazyLoginScene />
    </Suspense>
  ),
});

/** 管理画面（/admin）。未ログインなら /login、非 admin なら / へリダイレクト（#136）。 */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <Suspense fallback={null}>
      <LazySettingsScene />
    </Suspense>
  ),
  beforeLoad: requireAdminRoute,
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
  component: () => (
    <Suspense fallback={null}>
      <LazyAccountScene />
    </Suspense>
  ),
  beforeLoad: requireAuth,
});

/** 仮想オフィス画面（/office）。未ログインまたはネットワークエラーの場合は /login へリダイレクト（#240）。 */
const officeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/office",
  component: () => (
    <Suspense fallback={null}>
      <LazyOfficeScene />
    </Suspense>
  ),
  beforeLoad: requireAuth,
});

/** 招待リンク受諾画面（/invite/:token）。公開ルート（requireAuth なし・AuthLayout）。 */
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invite/$token",
  component: () => (
    <Suspense fallback={null}>
      <LazyAcceptInvitationScene />
    </Suspense>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  channelRoute,
  loginRoute,
  adminRoute,
  accountRoute,
  officeRoute,
  inviteRoute,
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
