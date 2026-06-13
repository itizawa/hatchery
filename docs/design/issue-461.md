# 設計書: Issue #461 auth と条件付きクエリ(useSubscriptionStatus)を Suspense クエリ方式へ移行する

> 親 Issue #459 のサブタスク（2/4・特殊ケース）。#459 基盤サブ（QueryBoundary, #460/PR #494）に依存。基盤は develop へマージ済み（`client/src/components/QueryBoundary.tsx`）。

## 背景

#459 の Suspense 移行のうち、`useSuspenseQuery` の制約上そのまま移行できない 2 フックを扱う。

- `useAuth`（`client/src/api/auth.ts`）: `fetchMe` が**未認証時（401）に `null` を返す**（`retry: false`）。エラー throw ではなく `null` データとして扱う必要がある。
- `useSubscriptionStatus`（`client/src/hooks/useSubscriptionStatus.ts`）: `enabled: !!communitySlug` の**条件付きクエリ**。`useSuspenseQuery` は `enabled` を持たない。

## 目的

auth と条件付きクエリを、**挙動を変えずに** Suspense クエリ方式（`useSuspenseQuery`）へ移行する。ローディングは #459 基盤の `QueryBoundary`（Suspense + ErrorBoundary）に委譲する。

## 受け入れ条件 → 入出力

### AC1: `useAuth` の `useSuspenseQuery` 化（未認証 = `null` データ）

- `useAuth` を `useQuery` → `useSuspenseQuery` に変える。`queryFn` は既存の `fetchMe`（401 で `null` を返し throw しない）をそのまま使う。
- これにより戻り値は `{ data: AuthUser | null }`（`isPending`/`isLoading`/`isError` を読む側は不要になる）。
- `router.tsx` の `requireAuth`/`requireAdminRoute` は **`fetchMe()` を直接呼ぶ実装のままで変更しない**（フックではないので Suspense の影響を受けない）。未認証リダイレクトはこれまで通り動く（テストで担保）。
- `AppHeader`: `isPending` による Skeleton 分岐を除去し、認証状態に応じた表示切替（ログインリンク ⇄ ユーザーメニュー）を `useAuth().data` の有無だけで行う。`useAuth` の Suspense は `AppHeader` を包む `QueryBoundary`（fallback = 従来と同じ `account-skeleton`）に委譲する。

入出力（テスト観点）:
- ログイン済み（200, AuthUser）→ ユーザーメニュートリガー表示・ログインリンク非表示。
- 未ログイン（401 → `null`）→ ログインリンク表示・ユーザーメニュートリガー非表示。
- 認証確認中 → `QueryBoundary` の fallback（`account-skeleton`）が表示される。

### AC2: 条件付き購読クエリの Suspense 化（`skipToken` 不可 → 条件付き子コンポーネント分割を採用）

**実装中の判明事項**: インストール済み `@tanstack/react-query` v5.100.14 では **`useSuspenseQuery` は `skipToken` を許容しない**（`"skipToken is not allowed for useSuspenseQuery"` を throw する）。`useSuspenseQuery` は `enabled` も持たないため、Issue 記載の代替「**条件付き子コンポーネント分割**」を採用する。

- フック `useSubscriptionStatus` を**廃止**し、render-prop コンポーネント `client/src/components/SubscriptionStatus.tsx` へ置換する。
  - `communitySlug` が空文字 → クエリを発行せず即座に `children(false)` を描画（fetch せず Suspense もしない）。従来の `enabled: !!communitySlug` と同じ挙動。
  - `communitySlug` が非空 → 内部子コンポーネント `SubscriptionStatusQuery` を**そのときだけマウント**し、`useSuspenseQuery` で購読状態を取得して `children(data.subscribed)` を描画する。
- 消費側（`CommunityScene`/`PostThreadScene`）は `<SubscriptionStatus communitySlug={slug}>{(subscribed) => ...}</SubscriptionStatus>` で `subscribed` を受け取る。ローディングはルートの Suspense（QueryBoundary）に委譲する。

入出力（テスト観点・`SubscriptionStatus.test.tsx`）:
- `communitySlug` 指定あり → `fetchSubscriptionStatus(slug)`（GET `/subscription`）が呼ばれ、結果の `subscribed` が render-prop に渡る。
- `communitySlug` 空文字 → `/subscription` fetch が呼ばれない・Suspense もせず即座に `false` が渡る。

### AC3: 消費コンポーネントの `isLoading`/`isError` 分岐除去 → QueryBoundary に委譲

- `AppHeader`: `isPending` Skeleton 分岐を除去（QueryBoundary に委譲）。
- `AccountScene`: `isLoading` Skeleton 分岐を除去（ルートの `<Suspense>` / QueryBoundary に委譲）。`useAuth().data` は `AuthUser | null`。account ルートは `requireAuth` で未認証リダイレクト済みなので、到達時は `data` が `AuthUser`。
- `CommunityScene`・`PostThreadScene`・`RootLayout`: `useAuth().data` の参照のみで `isLoading`/`isError` は元々読んでいないため分岐除去は不要（`useSuspenseQuery` 化で `data` の取得方法が Suspense ベースに変わるだけ）。`subscribed` は `SubscriptionStatus` render-prop から受け取る形へ置換。
- `RootLayout`: シェル（ヘッダ／サイドバー）は Outlet の Suspense の外側で `useAuth`（Suspense）を呼ぶため、`AppHeader` と `SidebarContent` を `QueryBoundary` で包み Suspense 祖先を与える（AppHeader の fallback は従来同等の `account-skeleton`、サイドバーは `null`）。

### AC4: client 内で完結・一方向 import・ビルド緑

- 変更は `client/` 内のみ。`@hatchery/common` への依存方向は不変（一方向）。`server` には触れない。
- `pnpm turbo run build|test|lint` 緑。

## 設計判断

1. **`useAuth` は `fetchMe` をそのまま使う**: `fetchMe` は 401 を `null`、5xx を throw に変換済み。`useSuspenseQuery` は「resolve した値（`null` 含む）をそのまま data に、reject を ErrorBoundary へ」流すので、未認証 = `null` データ・サーバエラー = ErrorBoundary という望ましい挙動が **queryFn 変更なし**で得られる。
2. **AppHeader を `QueryBoundary` で包む**: AppHeader と sidebar は RootLayout のシェル（Outlet の `<Suspense>` の外側）に居て `useAuth` を呼ぶ。Suspense 祖先が必要なため、`AppHeader` を `QueryBoundary`（fallback = 既存の `account-skeleton` 相当）で包んで局所的にローディングを表示する。エラー時は QueryBoundary の既定フォールバック（再試行ボタン）に委ねる。sidebar（`SidebarContent`）も `useAuth` を呼ぶため `QueryBoundary` で包む（fallback = null で従来の「auth 確定までナビ項目を出さない」挙動に合わせる）。
3. **購読クエリは「条件付き子コンポーネント分割」（`skipToken` は不可）**: `useSuspenseQuery` は v5.100.14 で `skipToken` を許容しないため、`communitySlug` 非空のときだけ `useSuspenseQuery` を呼ぶ子（`SubscriptionStatusQuery`）をマウントする `SubscriptionStatus` コンポーネントに置換する。これで「slug 空 → fetch しない・Suspense しない」を満たしつつ Suspense へ移行できる。
4. **`router.tsx` は無変更**: `requireAuth`/`requireAdminRoute` はフックでなく `fetchMe()` を直接 await する beforeLoad ガード。Suspense とは独立なので変更不要。受け入れ条件の「未認証リダイレクトが従来どおり動く」は既存テスト + 追加テストで担保する。

## テスト

- `client/src/components/SubscriptionStatus.test.tsx`（新規）: slug 空で `/subscription` fetch 未実行・即 `false`、slug ありで取得して `subscribed` を render-prop に渡すことを検証（旧 `useSubscriptionStatus.test.ts` は廃止）。
- `client/src/api/auth.test.ts`（既存）: `fetchMe` の 200/401/5xx は不変。
- `client/src/components/AppHeader.test.tsx`（既存）: ログイン済み/未ログインの表示切替・確認中の `account-skeleton`（QueryBoundary fallback）表示を Suspense 経由で担保。
- `client/src/router.test.tsx`・`client/src/routes/RootLayout.test.tsx`（既存 + 調整）: 認証ガードのリダイレクトとサイドバーの admin 項目分岐が不変であることを担保。サイドバー内容は auth 解決後に描画されるため `findBy` で待つよう調整。
- `client/src/routes/AccountScene.test.tsx`（既存 + 調整）: `useAuth` の `isLoading` モックを廃し、認証ローディングがルートの Suspense に委譲されること（解決前は見出し非表示・解決後に表示）を検証。
- `client/src/mocks/handlers.ts`: GET `/api/communities/:slug/subscription` ハンドラを追加（SubscriptionStatus が useSuspenseQuery で取得するため）。
- `client/src/test/setup.ts`: Suspense の 2 パス描画 + 並列実行下の競合に備え、testing-library の `asyncUtilTimeout` を 3000ms に引き上げ（描画は確実に完了する。単体実行では < 1s で解決）。

## ユーザー可視挙動

純粋なローディング実装の置き換え（`isLoading`/`isPending` 分岐 → Suspense + QueryBoundary）であり、**ユーザーから見た観察可能な期待動作（表示内容・遷移・空状態）は不変**。よって `e2e/` ユースケースの更新は不要（リファクタ）。

