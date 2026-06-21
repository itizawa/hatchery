# Issue #743 設計書: e2e/not-found spec.ts 新設（UC-404-01〜02）

## 背景・目的

`e2e/not-found/` ディレクトリには `usecases.md` が存在するが、`not-found.spec.ts` が未作成のため
Playwright による自動検証が行えない状態だった。本 Issue では UC-404-01・UC-404-02 に対応する
Playwright テストを実装し、404 画面の動作を e2e レベルで保証する。

## 受け入れ条件

1. `e2e/not-found/not-found.spec.ts` を新設する。
2. UC-404-01: `/xyz-nope` を開くと「ページが見つかりません」が表示され、ホーム導線がある。
3. UC-404-02: 404 画面の「ホームへ戻る」ボタンをクリックすると `/` へ遷移する。
4. `e2e/usecases.md` の not-found エリア行に UC-404-01〜02 が明記されている（確認済み: 既記載）。
5. `pnpm turbo run build lint test` が緑。

## 設計方針

### テスト対象の確認

- `NotFoundScene.tsx`: `createRootRoute` の `notFoundComponent` として登録済み（`router.tsx` L.145）。
  - 表示テキスト: `ページが見つかりません`
  - ホーム導線: MUI `Button` コンポーネント with `RouterLink to="/"`、ラベル `ホームへ戻る`
- `CommunityScene.tsx`: 存在しない slug の場合、`コミュニティが見つかりません` を表示（L.192）。
  - UC-404-02 相当は usecases.md の定義を読み直すと「ホーム導線クリック → / へ遷移」なので、
    主に `NotFoundScene` の動作検証に集中する。

### UC-404-01 実装方針

- `page.goto("/xyz-nope")` で未マッチ URL へアクセス。
- TanStack Router の `notFoundComponent` が `NotFoundScene` をレンダリングする。
- API モック: サイドバー・ヘッダーが表示されるため `**/api/communities` のモックが必要。
- 検証:
  - `page.getByText("ページが見つかりません")` が visible。
  - 英語 `Not Found` が表示**されない**（`expect(...).not.toBeVisible()`）。
  - `page.getByRole("link", { name: "ホームへ戻る" })` または `page.getByRole("button", { name: /ホームへ戻る/ })` が visible。

### UC-404-02 実装方針

- `page.goto("/xyz-nope")` → `ホームへ戻る` をクリック → `page.toHaveURL("/")` を検証。

### APIモック設計

home-feed.spec.ts の `setupCommonMocks` を参考に、404 画面に必要な最小限のモックを設定する。
サイドバーに `**/api/communities` が必要なため、空配列で返す最小モックを用意する。

### import スタイル

`e2e/home-feed/home-feed.spec.ts` に合わせ、`@playwright/test` から直接 import する。
`e2e/support/test.ts` の `test.todo` 拡張は todo スケルトンが必要な場合のみ使用するが、
本 Issue では UC-404-01〜02 をすべて実装するため `@playwright/test` から直接 import する。

## ファイル変更一覧

| ファイル | 変更種別 | 内容 |
|----------|----------|------|
| `e2e/not-found/not-found.spec.ts` | 新規作成 | UC-404-01〜02 の Playwright テスト |
| `docs/design/issue-743.md` | 新規作成 | 本設計書 |
| `e2e/usecases.md` | 変更なし | not-found エリア行は既に UC-404-01〜02 を記載済み |
