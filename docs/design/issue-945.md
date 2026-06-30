# 設計書: test: useCommunityFeed / useInfiniteHomeFeed フックの sessionId 注入テストを追加する (#945)

## 1. 目的 / 背景

`client/src/api/feed.ts` の `useInfiniteCommunityFeed` / `useInfiniteHomeFeed` は、
ログイン済みなら `userId`、未認証なら `guestId`（localStorage の `hatchery:guestId`）を sessionId として
API クエリに注入する。このフックレベルのロジックが未テストのため、回帰リスクがある。

Issue の記述では `useCommunityFeed` / `useInfiniteHomeFeed` だが、
現コードの実際の関数名は `useInfiniteCommunityFeed` / `useInfiniteHomeFeed`。
後者の実際の関数名に合わせてテストする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `useInfiniteCommunityFeed` の sessionId 注入（未認証 / 認証済み）テスト
- `useInfiniteHomeFeed` の sessionId 注入（未認証 / 認証済み）テスト

**やらないこと:**
- 無限スクロール（`fetchNextPage`）の挙動テスト（別 Issue）
- `fetchCommunityFeedPage` / `fetchHomeFeedPage` の純関数テスト（既存カバー済み）
- `useRecentPostsSidebar` のテスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useInfiniteCommunityFeed`: 未認証時に localStorage の guestId が sessionId として URL に含まれる
2. `useInfiniteCommunityFeed`: 認証済み時に userId が sessionId として URL に含まれる
3. `useInfiniteHomeFeed`: 未認証時に localStorage の guestId が sessionId として URL に含まれる
4. `useInfiniteHomeFeed`: 認証済み時に userId が sessionId として URL に含まれる
5. `pnpm turbo run test --filter=@hatchery/client` が緑

## 4. 設計方針

### テストファイル
`client/src/api/feed.hooks.test.tsx`（JSX が必要なため `.tsx` 拡張子・新規ファイル）

### モック戦略
- **`useAuth`**: `queryClient.setQueryData(AUTH_ME_QUERY_KEY, authUser)` で TanStack Query キャッシュを直接事前投入
  - `useSuspenseQuery` はキャッシュにデータがある場合はサスペンドせず同期的にデータを返す
- **`fetch`**: `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(...))` で openapi-fetch が使うグローバル fetch をインターセプト
- **localStorage（guestId）**: `localStorage.setItem("hatchery:guestId", guestId)` で直接セット（jsdom 環境）

### テスト用ラッパー
```tsx
QueryClientProvider > Suspense（fallback=null）> renderHook の子コンポーネント
```
`useSuspenseInfiniteQuery` がサスペンドする場合は `Suspense` バウンダリが必要。

### 検証方法
- `vi.fn()` で fetch を差し替え → フック呼び出し → `waitFor(() => expect(fetchMock).toHaveBeenCalled())` → `fetchMock.mock.calls[0][0]` から Request を取り出して URL に sessionId が含まれるか確認

## 5. 影響範囲 / 既存への変更

- **対象**: `client/` のみ
- **新規ファイル**: `client/src/api/feed.hooks.test.tsx`
- **既存ファイルへの変更**: なし

## 6. テスト計画（TDD で書くテスト一覧）

| # | フック | シナリオ | 期待値 |
|---|--------|---------|--------|
| 1 | `useInfiniteCommunityFeed` | 未認証（localStorage に guestId あり） | URL に `sessionId=<guestId>` を含む |
| 2 | `useInfiniteCommunityFeed` | 認証済み（userId あり） | URL に `sessionId=<userId>` を含む |
| 3 | `useInfiniteHomeFeed` | 未認証（localStorage に guestId あり） | URL に `sessionId=<guestId>` を含む |
| 4 | `useInfiniteHomeFeed` | 認証済み（userId あり） | URL に `sessionId=<userId>` を含む |

## 7. リスク・未決事項

- `useSuspenseInfiniteQuery` の Suspense 境界: `QueryClientProvider` の外に `Suspense` を包むことで対応
- `openapi-fetch` が global `fetch` を使っているため `vi.stubGlobal` でインターセプト可能（既存の `feed.test.ts` と同じアプローチ）
