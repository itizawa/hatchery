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
import { NotFoundScene } from "./routes/NotFoundScene";
import { RootLayout } from "./routes/RootLayout";
import { MainContentSkeleton } from "./components/MainContentSkeleton";
import { LoginDialog } from "./components/LoginDialog";
import { PostThreadSkeleton } from "./components/PostThreadSkeleton";
import { QueryBoundary } from "./components/QueryBoundary";
import { useLoginModal } from "./hooks/useLoginModal.js";

/** root の search param。`login=1`（モーダル開）を全ルートで共有する（#454）。 */
interface RootSearch {
  login?: boolean | number;
}

/**
 * root の search param を検証する（#454）。`login=1` / `login=true` を真として
 * ログインモーダルを開く。未指定・偽値のときは `login` を持たない（モーダルは閉じる）。
 * 他の search param（例: /admin の tab）は各ルートの validateSearch が別途検証する。
 */
function validateRootSearch(search: Record<string, unknown>): RootSearch {
  const raw = search.login;
  const login = raw === true || raw === 1 || raw === "1" || raw === "true";
  // #800: login=1（数値）を正規形とし、URL が /?login=true にならないようにする。
  // TanStack Router は validateSearch の戻り値を再シリアライズするため、ここで 1 を返すことで
  // 常に /?login=1 が URL に現れる（e2e 期待値との整合）。
  return login ? { login: 1 } : {};
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
const LazyAboutScene = lazyRouteComponent(() => import("./routes/AboutScene"), "AboutScene");
const LazyTermsScene = lazyRouteComponent(() => import("./routes/TermsScene"), "TermsScene");
const LazyPrivacyScene = lazyRouteComponent(() => import("./routes/PrivacyScene"), "PrivacyScene");
const LazyWorkerRankingScene = lazyRouteComponent(
  () => import("./routes/WorkerRankingScene"),
  "WorkerRankingScene",
);
const LazyWorkerScene = lazyRouteComponent(
  () => import("./routes/WorkerScene"),
  "WorkerScene",
);
const LazySearchScene = lazyRouteComponent(
  () => import("./routes/SearchScene"),
  "SearchScene",
);
const LazyAddWorkerScene = lazyRouteComponent(
  () => import("./routes/AddWorkerScene"),
  "AddWorkerScene",
);
const LazyEditWorkerScene = lazyRouteComponent(
  () => import("./routes/EditWorkerScene"),
  "EditWorkerScene",
);
const LazyAddCommunityScene = lazyRouteComponent(
  () => import("./routes/AddCommunityScene"),
  "AddCommunityScene",
);
const LazyEditCommunityScene = lazyRouteComponent(
  () => import("./routes/EditCommunityScene"),
  "EditCommunityScene",
);

/**
 * 認証ガード（#454）: 未ログイン（fetchMe が null）またはネットワークエラーの場合、
 * 公開ホーム（/）へ `login=1` 付きでリダイレクトし、ホーム上にログインモーダルを開いて
 * 認証導線へ誘導する（ページ遷移せず閉覧コンテキストを保つ思想に合わせ、専用ログインページへは飛ばさない）。
 * accountRoute の beforeLoad で使う。
 */
async function requireAuth(): Promise<void> {
  let user: Awaited<ReturnType<typeof fetchMe>>;
  try {
    user = await fetchMe();
  } catch {
    throw redirect({ to: "/", search: { login: 1 } });
  }
  if (!user) throw redirect({ to: "/", search: { login: 1 } });
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
    throw redirect({ to: "/", search: { login: 1 } });
  }
  if (!user) throw redirect({ to: "/", search: { login: 1 } });
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
 * ログインモーダル（#454）。root の search param `login` 駆動で開閉し、Root / Auth どちらの
 * レイアウト上でも閉覧コンテキストを保ったまま重ねて表示する。
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
  notFoundComponent: NotFoundScene,
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

/** 投稿全文検索ページ（/search）。認証不要・q クエリパラメータで title / text の ILIKE 部分一致検索（#751）。 */
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazySearchScene />
    </QueryBoundary>
  ),
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = typeof search.q === "string" && search.q.trim().length > 0 ? search.q.trim() : undefined;
    return q !== undefined ? { q } : {};
  },
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
    throw redirect({ to: "/", search: { login: 1 } });
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

/**
 * アカウント設定画面（/account）。未ログインまたはネットワークエラーの場合は /login へリダイレクト。
 * `?welcome=1` は初回ログイン（OAuth で新規ユーザー作成）直後の遷移で付与され、表示名設定を促す歓迎表示に使う。
 */
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: () => (
    <Suspense fallback={null}>
      <LazyAccountScene />
    </Suspense>
  ),
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): { welcome?: boolean } => {
    const raw = search.welcome;
    const welcome = raw === true || raw === 1 || raw === "1" || raw === "true";
    return welcome ? { welcome: true } : {};
  },
});

/** Hatchery 紹介ページ（/about）。認証不要の公開ページ。サイドバー付きの通常シェルで描画する（#1056）。 */
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: () => (
    <Suspense fallback={null}>
      <LazyAboutScene />
    </Suspense>
  ),
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

/** ワーカーランキング（/ranking）。認証不要の公開ページ。直近 7 日の閲覧数・純 vote スコアを表示（#665）。 */
const rankingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ranking",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyWorkerRankingScene />
    </QueryBoundary>
  ),
});

/** ワーカー個別プロフィールページ（/workers/$workerId）。認証不要の公開ページ（#929）。 */
const workerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workers/$workerId",
  component: () => (
    <QueryBoundary fallback={<MainContentSkeleton />}>
      <LazyWorkerScene />
    </QueryBoundary>
  ),
});

/** ワーカー作成ページ（/admin/workers/new）。未ログイン・非 admin は / へリダイレクト（#888）。 */
const adminWorkerNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/workers/new",
  component: () => (
    <Suspense fallback={null}>
      <LazyAddWorkerScene />
    </Suspense>
  ),
  beforeLoad: requireAdminRoute,
});

/** ワーカー編集ページ（/admin/workers/:workerId/edit）。未ログイン・非 admin は / へリダイレクト（#888）。 */
const adminWorkerEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/workers/$workerId/edit",
  component: () => (
    <Suspense fallback={null}>
      <LazyEditWorkerScene />
    </Suspense>
  ),
  beforeLoad: requireAdminRoute,
});

/** コミュニティ作成ページ（/admin/communities/new）。未ログイン・非 admin は / へリダイレクト（#889）。 */
const adminCommunityNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/communities/new",
  component: () => (
    <Suspense fallback={null}>
      <LazyAddCommunityScene />
    </Suspense>
  ),
  beforeLoad: requireAdminRoute,
});

/** コミュニティ編集ページ（/admin/communities/$communityId/edit）。未ログイン・非 admin は / へリダイレクト（#889）。 */
const adminCommunityEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/communities/$communityId/edit",
  component: () => (
    <Suspense fallback={null}>
      <LazyEditCommunityScene />
    </Suspense>
  ),
  beforeLoad: requireAdminRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  popularRoute,
  communitiesRoute,
  communityRoute,
  postRoute,
  searchRoute,
  loginRoute,
  lpRoute,
  adminRoute,
  adminWorkerNewRoute,
  adminWorkerEditRoute,
  adminCommunityNewRoute,
  adminCommunityEditRoute,
  accountRoute,
  aboutRoute,
  termsRoute,
  privacyRoute,
  rankingRoute,
  workerRoute,
]);

export interface CreateAppRouterOptions {
  /** テストで memory history を差し込むための任意 history（未指定なら browser history）。 */
  history?: RouterHistory;
}

/**
 * アプリのルータを生成する。history を差替可能にしてテスト（memory history）から利用する。
 */
export const createAppRouter = (options: CreateAppRouterOptions = {}) =>
  createRouter({
    routeTree,
    history: options.history,
    defaultPreload: "intent",
    defaultViewTransition: true,
    scrollRestoration: true,
    scrollToTopSelectors: ['[data-scroll-restoration-id="main-content"]'],
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
