# 設計書: サイドバーに購読コミュニティセクションと未読バッジを追加する (#934)

## 1. 目的 / 背景

現在のサイドバーは全コミュニティを同列表示しており、購読中コミュニティに新着があるかが一目でわからない。
#933 で実装した `lastViewedAt` / 未読数 API を活用し、購読コミュニティを上部に集めて未読バッジを表示することで
リテンション動機を高める。

## 2. スコープ（やること / やらないこと）

### やること
- サイドバーに「購読中」セクションを追加（ログイン済み・購読 1 件以上の場合のみ）
- 各購読コミュニティに未読投稿数バッジを表示（`unread_count >= 1` のとき）
- バッジ上限 `99+` 表示
- コミュニティページ訪問時に `PATCH /api/communities/:slug/mark-viewed` を自動呼び出し
- mark-viewed 後に `unread-counts` クエリを invalidate

### やらないこと
- 全コミュニティ一覧（`SidebarCommunitySection`）の変更
- バッジの永続化・サーバー側ロジック変更（#933 実装済み）
- Skeleton ローディング表示（Issue 指定: ローディング中は単純に非表示）

## 3. 受け入れ条件（テストに落とせる粒度）

1. ログイン済み・購読 1 件以上 → サイドバーに「購読中」セクションが表示される
2. 各購読コミュニティに `unread_count >= 1` のとき Badge が表示される
3. `unread_count = 0` のコミュニティは Badge を表示しない
4. `unread_count > 99` のとき `"99+"` と表示される
5. 未ログインユーザーは「購読中」セクションが表示されない
6. コミュニティページ訪問時に mark-viewed が自動呼び出しされる（認証済み・購読中のみ）
7. mark-viewed 後に unread-counts クエリが invalidate される

## 4. 設計方針

### APIクライアント追加（`client/src/api/subscriptions.ts`）
- `unreadCountsQueryKey()` — クエリキー
- `fetchUnreadCounts()` — `GET /api/subscriptions/unread-counts`
- `useUnreadCounts()` — `useSuspenseQuery` ラッパー（Suspense 化）
- `markCommunityViewed(slug)` — `PATCH /api/communities/{slug}/mark-viewed`
- `useMarkCommunityViewed(slug)` — `useMutation` + `onSuccess` で `unreadCountsQueryKey` を invalidate

### 新コンポーネント（`client/src/components/SubscribedCommunitiesSection.tsx`）
- `SidebarCommunitySection` と同パターン（collapsible + QueryBoundary）
- `useAuth()` でユーザーを取得し、未ログインなら `null` を返す
- `useUnreadCounts()` で未読数を取得し、購読コミュニティの一覧を表示
- MUI `Badge` でバッジ表示（`badgeContent={unread_count > 99 ? "99+" : unread_count}`）
- ローディング中はバッジ非表示（Issue 指定）

### CommunityScene の変更（`client/src/routes/CommunityScene.tsx`）
- `CommunityContent` 内に `useEffect` でマウント時 mark-viewed を呼び出す
- `useMarkCommunityViewed(slug)` の `mutate` を `useEffect(() => { mutate(); }, [communitySlug])` で呼ぶ
- `SubscriptionStatus` が `subscribed: true` を返す場合のみ呼び出す（未購読コミュニティはスキップ）

### RootLayout の変更（`client/src/routes/RootLayout.tsx`）
- `SidebarContent` に `SubscribedCommunitiesSection` を追加
- `SidebarGlobalNav` → Divider → `SubscribedCommunitiesSection` → Divider → `SidebarCommunitySection` の順序

### uiParts への追加
- `Badge` を `@mui/material/Badge` からエクスポート

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|---------|----------|
| `client/src/api/subscriptions.ts` | 関数・フック追加 |
| `client/src/components/uiParts/index.ts` | Badge エクスポート追加 |
| `client/src/components/SubscribedCommunitiesSection.tsx` | 新規作成 |
| `client/src/routes/RootLayout.tsx` | SubscribedCommunitiesSection 追加 |
| `client/src/routes/CommunityScene.tsx` | mark-viewed useEffect 追加 |
| `client/src/mocks/handlers.ts` | unread-counts / mark-viewed ハンドラ追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### `client/src/api/subscriptions.test.ts`
- `fetchUnreadCounts`: 200 で unread_counts 配列を返す
- `markCommunityViewed`: 200 で正常終了する

### `client/src/components/SubscribedCommunitiesSection.test.tsx`
- ログイン済み・未読あり → バッジが表示される
- ログイン済み・未読 0 → バッジが表示されない
- unread_count > 99 → `"99+"` と表示される
- 未ログイン → 購読セクション非表示

### `client/src/routes/CommunityScene.test.tsx`
- マウント時に mark-viewed が呼ばれる（認証済み・購読中）
- 未購読コミュニティでは mark-viewed が呼ばれない

## 7. リスク・未決事項

- `fetchUnreadCounts` は認証済みの場合のみ呼ぶ（`SubscribedCommunitiesSection` が `useAuth` でガード）
- `useUnreadCounts` は Suspense 化するため、`QueryBoundary` で囲む必要あり
