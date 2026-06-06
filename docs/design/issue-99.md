# 設計書: React Suspense + MUI Skeleton によるローディング UI を実装する (#99)

## 1. 目的 / 背景

`ChannelList` と `ChannelScene` は TanStack Query の `useQuery` でデータを取得しているが、ローディング中のフォールバック UI が存在せず、空表示になる。
React Suspense + MUI Skeleton を導入し、データ取得中はスケルトンを表示してユーザー体験を向上させる。

## 2. スコープ（やること / やらないこと）

### やること
- `useChannels` / `useChannelMessages` を `useSuspenseQuery` に移行
- `ChannelListSkeleton` コンポーネントを作成し `RootLayout` でラップ
- `ChannelViewSkeleton` コンポーネントを作成し `router.tsx` でラップ
- 既存テストを `useSuspenseQuery` に合わせて更新
- 新規 Skeleton のスモークテストを追加

### やらないこと
- `useAuth` / `usePostChannelMessage` など他フックの Suspense 化
- エラーバウンダリの追加
- ChannelView 以外の画面の Skeleton 化

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useChannels` が `useSuspenseQuery` を使い、`data` が常に `Channel[]`（undefined なし）を返す
2. `useChannelMessages` が `useSuspenseQuery` を使い、`data` が常に `MessageRecord[]`（undefined なし）を返す
3. `ChannelListSkeleton` がレンダリングできる（クラッシュしない）
4. `ChannelViewSkeleton` がレンダリングできる（クラッシュしない）
5. `RootLayout` の `<ChannelList />` が `<Suspense fallback={<ChannelListSkeleton />}>` で包まれている
6. `router.tsx` の `ChannelScene` が `<Suspense fallback={<ChannelViewSkeleton />}>` で包まれている
7. 既存の `ChannelList` テストが Suspense 対応 wrapper で通る（チャンネル一覧の描画が確認できる）
8. Skeleton コンポーネントのスモークテスト（クラッシュしないこと）が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `useSuspenseQuery` への移行
- `@tanstack/react-query` の `useSuspenseQuery` は `useQuery` と同じシグネチャだが、loading 時にPromiseをthrowし、`data` は常に defined（`T`型、`undefined`なし）
- `ChannelList.tsx` の `const { data: channels = [] }` → `const { data: channels }` に変更（デフォルト値不要）
- `ChannelScene.tsx` の `const { data: messages = [] }` → `const { data: messages }` に変更

### Skeleton コンポーネント
- `ChannelListSkeleton`: サイドバーのチャンネル一覧に相当。`Skeleton` を3〜4行並べたリスト状。
- `ChannelViewSkeleton`: チャンネルのメッセージ一覧に相当。ヘッダ1行 + メッセージ行3〜5件のSkeleton。

### Suspense の設置場所
- `RootLayout.tsx`: `<ChannelList />` を `<Suspense fallback={<ChannelListSkeleton />}>` でラップ
- `router.tsx`: `channelRoute` の `component` をラッパー関数にして `<Suspense>` で包む

### テスト更新方針
- `useSuspenseQuery` は Suspense boundary を必要とするため、テストの `renderWithClient` ヘルパに `<Suspense>` を追加
- 既存テストのアサーション・期待値は変更しない

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client** のみ
  - `client/src/api/channels.ts`: `useChannels`, `useChannelMessages` を `useSuspenseQuery` に変更
  - `client/src/components/ChannelList.tsx`: `data` のデフォルト値除去
  - `client/src/routes/ChannelScene.tsx`: `data` のデフォルト値除去
  - `client/src/routes/RootLayout.tsx`: `<Suspense>` ラッパーを追加
  - `client/src/router.tsx`: `channelRoute` を `<Suspense>` でラップ
  - `client/src/components/ChannelListSkeleton.tsx`: 新規作成
  - `client/src/components/ChannelViewSkeleton.tsx`: 新規作成
  - `client/src/components/ChannelList.test.tsx`: `renderWithClient` に `<Suspense>` を追加
  - `client/src/components/ChannelListSkeleton.test.tsx`: 新規作成
  - `client/src/components/ChannelViewSkeleton.test.tsx`: 新規作成

## 6. テスト計画（TDDで書くテスト一覧）

1. `ChannelListSkeleton.test.tsx` - スモークテスト: レンダリングできること
2. `ChannelViewSkeleton.test.tsx` - スモークテスト: レンダリングできること
3. `ChannelList.test.tsx` - 既存テスト: `renderWithClient` に `<Suspense>` を追加して通ること

## 7. リスク・未決事項

- `useSuspenseQuery` は Suspense boundary の中で使わないと runtime error になる。`Suspense` の設置場所を正確に実装することが重要。
- `QueryClientProvider` 内で `useSuspenseQuery` を使う場合、`QueryClientProvider` → `Suspense` の順（外から内）にネストする必要がある。
