# Issue #236 設計書: フロントエンドのルート単位 Lazy ロード（コード分割）を導入

## 背景・目的

`client/src/router.tsx` の全ルートコンポーネントが静的 import されているため、初回ロードで全ページ分のコードが 1 バンドルに含まれる。未ログイン時に不要な画面（HomeScene, ChannelScene, AccountScene, SettingsScene 等）のコードが `/login` ページ表示時に無駄に配信される。

本 Issue ではルート単位の動的 import（コード分割）を導入して初回バンドルサイズを削減する。

## 実装方針

### `lazyRouteComponent` の利用

TanStack Router が提供する `lazyRouteComponent` を使用する。これは React.lazy に preload 機能を追加したもので、TanStack Router の `defaultPreload: "intent"` と組み合わせてホバー時プリロードが機能する。

```ts
import { lazyRouteComponent } from "@tanstack/react-router";

const LazyHomeScene = lazyRouteComponent(() => import("./routes/HomeScene"));
```

### Suspense フォールバック

`lazyRouteComponent` は React.lazy と同様に Suspense が必要。各ルートの component を Suspense でラップする。

- `indexRoute` / `loginRoute` / `accountRoute` / `inviteRoute` / `officeRoute`: 汎用ローディングフォールバック（`null` または `ChannelViewSkeleton` 流用）
- `channelRoute`: 既存の `<Suspense fallback={<ChannelViewSkeleton />}>` ラッパーを維持
- `adminRoute`: `SettingsScene` を lazy 化

### ルートの変更点

各ルートの `component` フィールドで静的 import を動的 import に切り替える。`beforeLoad`・`validateSearch`・`path`・`defaultPreload` 等は変更しない。

```ts
// Before
const indexRoute = createRoute({
  component: HomeScene,
  ...
});

// After
const indexRoute = createRoute({
  component: lazyRouteComponent(() => import("./routes/HomeScene")),
  ...
});
```

`channelRoute` は既存の Suspense ラッパーと LazyChannelScene を組み合わせる：

```ts
const LazyChannelScene = lazyRouteComponent(() => import("./routes/ChannelScene"));

const channelRoute = createRoute({
  component: () => (
    <Suspense fallback={<ChannelViewSkeleton />}>
      <LazyChannelScene />
    </Suspense>
  ),
  ...
});
```

### テスト方針

既存の `router.test.tsx` は memory history によるルートナビゲーションテストで、動的 import に切り替えても引き続き動作する（Vitest は動的 import を同期的に解決する）。

受け入れ条件 #5 に対応するため、以下を追加・確認する：
- `/account`, `/admin`, `/invite/:token` ルートが正しく描画されること
- 未ログイン時のリダイレクトが引き続き動作すること

## ファイル変更対象

- `client/src/router.tsx`: 静的 import → `lazyRouteComponent` による動的 import
- `client/src/router.test.tsx`: 動的 import 後のテストを更新・追加

## 受け入れ条件との対応

1. 全ルートが `lazyRouteComponent` による動的 import に切り替わる
2. 各ルートに Suspense フォールバック UI が設定される
3. ルートのパス・`beforeLoad`・`validateSearch`・`defaultPreload` は変更なし
4. `vite build` でページ単位チャンク分割が確認できる
5. 既存テストが動作し、新テストで全ルート描画を担保する
6. import 境界（client → common の一方向）を維持する
7. `pnpm turbo run build` / `test` / `lint` が全て緑
