# 設計書: community 系のサーバ状態取得を useSuspenseQuery へ移行する (#462)

> 親 Issue #459 のサブタスク（3/4・community 系）。**#459 基盤サブ（#460 QueryBoundary）に依存**（#460 は close 済み・`client/src/components/QueryBoundary.tsx` 実装済み）。

## 1. 目的 / 背景

#459 のうち最もボリュームの大きい community 系データ取得を Suspense クエリへ移行する。
`client/src/api/communities.ts` のクエリフック群（一覧・詳細・投稿フィード・無限スクロール）を
`useSuspenseQuery` / `useSuspenseInfiniteQuery` に統一し、`data` の型を締める（`undefined` を取らない）。
使用シーン/コンポーネントから `isLoading` / `isPending` / `isError` 分岐を排除し、
ローディング/エラー表示を `#460` の共通 `QueryBoundary`（`Suspense` + `ErrorBoundary`）へ委譲する。

`useAuth`（`auth.ts`）・`useSubscriptionStatus`（`hooks/useSubscriptionStatus.ts`）は **#461 の担当**であり、
本 Issue では非 Suspense のまま据え置く（これらは suspend しないため本変更と独立して機能する）。

## 2. スコープ

### やること（移行対象フック・`communities.ts`）

| フック | 旧 | 新 |
|--------|----|----|
| `useCommunities`（管理一覧） | `useQuery` | `useSuspenseQuery` |
| `usePublicCommunities`（公開一覧） | `useQuery` | `useSuspenseQuery` |
| `useCommunityFeed` | `useQuery` | `useSuspenseQuery` |
| `usePostThread` | `useQuery` | `useSuspenseQuery` |
| `useRecentWorkers` | `useQuery` | `useSuspenseQuery` |
| `useInfiniteHomeFeed` | `useInfiniteQuery` | `useSuspenseInfiniteQuery` |

移行後、各フックの戻り値 `data` は型上 non-undefined になる。ミューテーション（`useVotePost` 等）は対象外。

### やらないこと
- `useAuth` / `useSubscriptionStatus` の Suspense 化（#461）。
- admin/account 系フックの移行（#463）。
- `queryClient.ts` の `throwOnError` 等の方針変更（既定のまま。Suspense クエリは失敗時に throw → `QueryBoundary` の `ErrorBoundary` が捕捉する）。
- サーバ API・common スキーマの変更（client 内で完結）。

## 3. 設計判断

### 3.1 ローディング/エラー境界の配置

各シーンは `router.tsx` の route component で **`QueryBoundary`** に包む。
従来はシーン内で `isLoading`/`error` を分岐し、route component 側は素の `<Suspense fallback>` だった。
これを `<QueryBoundary fallback={<MainContentSkeleton/>}>` へ置換し、ローディングは Suspense fallback、
取得失敗は ErrorBoundary フォールバックに一元化する。

### 3.2 「一部だけ先に表示」を維持するための局所境界

現状の UX で「**post 本文は表示しつつ右サイドバー（コミュニティ詳細）だけスケルトン**」
（`PostThreadScene` #409）、および community ページの「最近投稿したワーカー」セクション単独ローディングがある。
全フックを 1 コンポーネントで suspend させるとシーン全体が 1 つの fallback に落ちてしまうため、
**サイドバー / セクション側のフックを独立した子コンポーネントに切り出し、それぞれ専用の `QueryBoundary` で包む**。

- `PostThreadScene`: `usePostThread`（本文）はシーン本体で suspend（route の `QueryBoundary` が `post-thread-skeleton` を fallback に出す）。
  `usePublicCommunities`（所属コミュニティ特定→サイドバー）は子 `PostThreadSidebar` に分離し、
  その子を `QueryBoundary`（fallback=`community-sidebar-skeleton`）で包む。post 本文は先に出て、サイドバーだけ後追いで描画される従来挙動を維持。
- `CommunityScene`: `usePublicCommunities`・`useCommunityFeed` はシーン本体で suspend。
  `useRecentWorkers` は子 `RecentWorkersPanel` に分離し、専用 `QueryBoundary`（fallback=「読み込み中...」）で包む。

### 3.3 レイアウト常設コンポーネント（SidebarCommunitySection）

`SidebarCommunitySection` は `RootLayout` のサイドバー（Outlet の `<Suspense>` 外）に常設される。
ここで `useSuspenseQuery` をそのまま使うとサイドバー全体（=レイアウト）が suspend してしまうため、
**コンポーネント内部で `usePublicCommunities` を呼ぶ部分を子に切り出し、`QueryBoundary` で局所的に包む**。
ローディング中はリスト部のみ空（`fallback={null}`）、取得失敗時もサイドバーは縮退（エラー時 fallback=`null`）させ、
レイアウトを壊さない（従来も「未取得時は何も描画しない」挙動だった）。

### 3.4 CommunitiesTab（作成フォーム + 一覧）

`CommunitiesTab` は「作成フォーム（mutation のみ）」と「一覧テーブル（`useCommunities`）」を持つ。
フォームは即時表示したいため、一覧部分のみ子 `CommunityListPanel` に切り出して `useSuspenseQuery` 化し、
`QueryBoundary`（fallback=既存のスケルトン行）で包む。フォーム本体は suspend しない。

### 3.5 RecentWorkersSection の純化

`RecentWorkersSection` は現在 `isLoading`/`isError` props を受ける presentational コンポーネント。
ローディング/エラーは `QueryBoundary` に委譲するため、これらの props を廃し **`workers` のみ**を受ける純表示に簡素化する。
呼び出し側（`CommunityScene` の `RecentWorkersPanel`）は Suspense フックの `data` を渡すだけにする。

### 3.6 import 境界
client → common の一方向のみ。`react-error-boundary` は #460 で導入済み。common には何も追加しない。

## 4. 受け入れ条件（テストに落とす）

- AC1: `communities.ts` の対象 6 フックが `useSuspenseQuery`/`useSuspenseInfiniteQuery` を返し、`data` が non-undefined。
- AC2: 対象シーン/コンポーネントから `isLoading`/`isPending`/`isError` 分岐が除去され、`QueryBoundary` に委譲されている。スケルトン（`MainContentSkeleton`/`post-thread-skeleton`/`community-sidebar-skeleton`/一覧スケルトン）は Suspense fallback で維持。
- AC3: 各対象について（QueryBoundary でラップして）
  - 成功表示が出る
  - 取得失敗時に ErrorBoundary フォールバックが表示される
  - ローディング中に Suspense fallback が表示される
  をテストで検証する。
- AC4: client 内で完結し client → common 一方向 import を守る。`pnpm turbo run build|test|lint` 緑。

## 5. ユーザー可視挙動

ローディング/エラーの**表示位置・文言**は概ね維持する（route 単位の skeleton・サイドバー skeleton・取得失敗メッセージ）。
取得失敗時のシーン全体エラーは `QueryBoundary` 既定の「データの取得に失敗しました。＋再試行」へ寄る箇所がある
（従来のシーン固有文言「フィードの取得に失敗しました。」等は ErrorBoundary 既定表示へ統一）。
この差分は `e2e/community`・`e2e/home` のユースケースに観察可能な期待として反映する。
