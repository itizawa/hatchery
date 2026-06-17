# 設計書: Issue #529 — 404 Not Found 画面の整備

## 背景・目的

存在しないルート（例: `/xyz-nope`）を開くと TanStack Router の既定表示「Not Found」という素の英語テキストだけが表示される。
日本語・スタイル・ホームへの導線を整え、迷子ユーザーを回遊に戻せるようにする。

## 受け入れ条件

1. カスタム NotFoundScene コンポーネントを設定し、「ページが見つかりません」（日本語）と `/`（ホーム）への導線を出す。
2. 既存のアプリシェル（ヘッダー/サイドバー）内に自然に収まり、レイアウトが破綻しない。
3. NotFoundScene の RTL テストを追加する（「見つかりません表示」と「ホームリンク」の存在）。
4. `pnpm turbo run build test lint` が緑。

## 設計判断

### TanStack Router の `notFoundComponent`

`createRootRoute` の `notFoundComponent` オプションを使い、未マッチ URL 時に描画するコンポーネントを指定する。
これにより既存のアプリシェル（AppShell → RootLayout）の中に `notFoundComponent` がレンダリングされるため、
ヘッダー・サイドバーが維持されたままカスタム 404 表示が出る。

### NotFoundScene コンポーネント

- `client/src/routes/NotFoundScene.tsx` に配置（他のシーンと同じディレクトリ）
- `TermsScene.tsx` と同様の静的コンポーネント構造を踏襲
- 中央揃えで「ページが見つかりません」テキスト + ホームへの MUI `Button` 導線
- `HomeFeedScene.tsx:70-83` の空状態表示パターン（`Box sx={{ textAlign: "center", py: 4 }}`）を流用
- `TanStack Router` の `Link` を使い `/` へのリンクボタンを出す

### router.tsx の変更

`createRootRoute` の引数に `notFoundComponent: NotFoundScene` を追加するだけ。
既存の全ルート定義・AppShell・レイアウト切替ロジックに変更なし。

### テスト方針

`NotFoundScene.test.tsx` を新規作成。RTL で直接 `NotFoundScene` をレンダリングし、
- 「ページが見つかりません」のテキスト存在確認
- ホーム（`/`）へのリンク存在確認

`@tanstack/react-router` の `Link` は他のテストと同様に `vi.mock` でシンプルな `<a>` にスタブする。
