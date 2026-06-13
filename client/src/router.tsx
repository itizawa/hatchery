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
import { MainContentSkeleton } from "./components/MainContentSkeleton";
import { LoginDialog } from "./components/LoginDialog";
import { PostThreadSkeleton } from "./components/PostThreadSkeleton";
import { QueryBoundary } from "./components/QueryBoundary";
import { useLoginModal } from "./hooks/useLoginModal.js";

/** root の search param。`login=1`（モーダル開）を全ルートで共有する（#454）。 */
interface RootSearch {
  login?: boolean;
}

/**
 * root の search param を検証する（#454）。`login=1` / `login=true` を真として
 * ログインモーダルを開く。未指定・偽値のときは `login` を持たない（モーダルは閉じる）。
 * 他の search param（例: /admin の tab）は各ルートの validateSearch が別途検証する。
 */
function validateRootSearch(search: Record<string, unknown>): RootSearch {
  const raw = search.login;
  const login = raw === true || raw === 1 || raw === "1" || raw === "true";
  return login ? { login: true } : {};
}

// ルートコンポーネントを lazyRouteComponent で動的 import（コード分割）する。
// TanStack Router の defaultPreload: "intent" と組み合わせ、ホバー時にプリロードされる。
const LazyHomeFeedScene = lazyRouteComponent(
  () => import("./routes/HomeFeedScene"),
  "HomeFeedScene",
);
const LazyCommunityBrowseScene = lazyRouteComponent(
  () => import("./routes/CommunityBrowseScene"),
  "CommunityBrowseScene",
);
const LazyCommunityScene = lazyRouteComponent(
  () => import("./routes/CommunityScene"),
  "CommunityScene",
);
const LazyPostThreadScene = lazyRouteComponent(
  () => import("./routes/PostThreadScene"),
  "PostThreadScene",
);
const LazyLandingScene = lazyRouteComponent(() => import("./routes/LandingScene"), "LandingScene");
const LazySettingsScene = lazyRouteComponent(() => import("./routes/SettingsScene"), "SettingsScene");
const LazyAccountScene = lazyRouteComponent(() => import("./routes/AccountScene"), "AccountScene");
const LazyTermsScene = lazyRouteComponent(() => import("./routes/TermsScene"), "TermsScene");
const LazyPrivacyScene = lazyRouteComponent(() => import("./routes/PrivacyScene"), "PrivacyScene");

/**
 * 認証ガード（#454）: 未ログイン（fetchMe が null）またはネットワークエラーの場合、
 * 公開ホーム（/）へ `login=1` 付きでリダイレクトし、ホーム上にログインモーダルを開いて
 * 認証導線へ誘導する（ページ遷移せず閲覧コンテキストを保つ思想に合わせ、専用ログインページへは飛ばさない）。
 * accountRoute の beforeLoad で使う。
 */
async function requireAuth(): Promise<void> {
  let user: Awaited<ReturnType<typeof fetchMe>>;
  try {
    user = await fetchMe();
  } catch {
    throw redirect({ to: "/", search: { login: true } });
  }
  if (!user) throw redirect({ to: "/", search: { login: true } });
}

/**
 * admin ロール専用ガード（#136 / #454）: 未ログインならホーム上にログインモーダルを開き、
 * 非 admin なら / へリダイレクト。adminRoute の beforeLoad で使う。
 */
async function requireAdminRoute(): Promise<void> {
  let user: Awaited<ReturnType<typeof fetchMe>>;
  try {
    user = await fetchMe();
  } catch {
    throw redirect({ to: "/", search: { login: true } });
  }
  if (!user) throw redirect({ to: "/", search: { login: true } });
  if (!isAdmin(user)) throw redirect({ to: "/" });
}

/**
 * サイドバーなしで描画する auth 系ルートかどうかを判定する。
 * /lp は完全一致で判定する（#454: /login ルートは廃止し /?login=1 へリダイレクト）。
 */
function isAuthLayout(pathname: string): boolean {
  return pathname === "/lp";
}

/**
 * ログインモーダル（#454）。root の search param `login` 駆動で開閉し、
 * Root / Auth どちらのレイアウト上でも閲覧コンテキストを保ったまま重ねて表示する。
 */
function LoginModalMount(): ReactElement {
  const { isOpen, closeLogin } = useLoginModal();
  return <LoginDialog open={isOpen} onClose={closeLogin} />;
}

/**
 * アプリ全体のシェル。現在のパスに応じて
 * - auth 系ルート（/lp）→ AuthLayout（サイドバーなし）
 * - その他 → RootLayout（サイドバーあり）
 * を切り替える。いずれの場合もログインモーダル（LoginModalMount）を重ねてマウントし、
 * `?login=1` で開く（#454）。ルートの ID を変えない方式のため、既存の useSearch 等への影響がない。
 */
function AppShell(): ReactElement {
  const { pathname } = useLocation();
  return (
    <>
      {isAuthLayout(pathname) ? <AuthLayout /> : <RootLayout />}
      <LoginModalMount />
    </>
  );
}

// ルートはコードベースで定義する（ファイルルーティングの codegen には依存しない）。
const rootRoute = createRootRoute({
  component: AppShell,
  validateSearch: validateRootSearch,
});

/** ホームフィード（/）。認証済みなら購読フィード、未認証ならゲスト向け誘導 UI を表示する（#341）。 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyHomeFeedScene />
    </QueryBoundary>
  ),
});

/** 人気フィード（/popular）。vote 数降順の公開フィード（#435）。認証不要。 */
const popularRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/popular",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyHomeFeedScene sort="popular" />
    </QueryBoundary>
  ),
});

/** コミュニティブラウズ（/communities）。認証不要の公開ページ。 */
const communitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/communities",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyCommunityBrowseScene />
    </QueryBoundary>
  ),
});

/** コミュニティページ（/communities/$slug）。フィード + 購読ボタン。認証不要。 */
const communityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/communities/$slug",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyCommunityScene />
    </QueryBoundary>
  ),
});

/** 投稿スレッド（/posts/$postId）。post + comments 表示。認証不要。 */
const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts/$postId",
  component: () => (
    <QueryBoundary fallback={<PostThreadSkeleton />}>
      <LazyPostThreadScene />
    </QueryBoundary>
  ),
});

/**
 * 旧ログインルート（/login）。#454 でログインはモーダル化したため、
 * このルートは廃止せず公開ホーム（/?login=1）へリダイレクトし、ホーム上でログインモーダルを開く。
 * 既存のブックマーク・外部リンク・OAuth 失敗時フォールバックの dead link を防ぐ後方互換。
 */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    throw redirect({ to: "/", search: { login: true } });
  },
});

/** ランディングページ（/lp）。未ログイン向けの紹介ページ。認証不要・サイドバーなしの AuthLayout で描画する（#167）。 */
const lpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lp",
  component: () => (
    <Suspense fallback={null}>
      <LazyLandingScene />
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

/** 利用規約ページ（/terms）。認証不要の公開ページ。サイドバー付きの通常シェルで描画する（#484）。 */
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: () => (
    <Suspense fallback={null}>
      <LazyTermsScene />
    </Suspense>
  ),
});

/** プライバシーポリシーページ（/privacy）。認証不要の公開ページ。サイドバー付きの通常シェルで描画する（#484）。 */
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: () => (
    <Suspense fallback={null}>
      <LazyPrivacyScene />
    </Suspense>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  popularRoute,
  communitiesRoute,
  communityRoute,
  postRoute,
  loginRoute,
  lpRoute,
  adminRoute,
  accountRoute,
  termsRoute,
  privacyRoute,
]);

export interface CreateAppRouterOptions {
  /** テストで memory history を差し込むための任意 history（未指定なら browser history）。 */
  history?: RouterHistory;
}

/**
 * アプリのルータを生成する。history を差替え可能にしてテスト（memory history）から利用する。
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
