# 設計書: client/src/components/OgpCard.tsx の表示・非表示条件のレンダリングテストを追加する (#711)

## 1. 目的 / 背景

`client/src/components/OgpCard.tsx` は URL の OGP メタデータを取得してカード表示するコンポーネントだが、テストファイルが存在しない。「`title` が取得できなければ null を返す」「データ取得中は何も表示しない」「クリック/Enter キーで外部リンクを開く」などの分岐ロジックは回帰リスクが高いため、RTL テストでカバーする。

## 2. スコープ（やること / やらないこと）

やること:
- `client/src/components/OgpCard.test.tsx` を新規作成
- `useOgp` が `undefined`（取得中）のとき何も描画しないことの確認
- `ogp.title` が `null` / `undefined` のとき何も描画しないことの確認
- `ogp.title` が存在するときカードとタイトルテキストが描画されることの確認
- `ogp.image` が存在するとき `<img>` 要素が描画されることの確認
- クリックで `openExternalLink(url)` が呼ばれることの確認
- `Enter` キー押下で `openExternalLink(url)` が呼ばれることの確認
- `useOgp` / `useExternalLink` を `vi.mock` でモックして制御

やらないこと:
- OGP 取得の HTTP 通信テスト（MSW 利用・Issue #712 で対応）
- `useExternalLink` / `isExternalUrl` のテスト（Issue #717 で対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useOgp` の返却 data が `undefined`（取得中）のときは何もレンダリングされない
2. `ogp.title` が `null` のときは何もレンダリングされない
3. `ogp.title` が存在するときカード要素がレンダリングされ、タイトルテキストが表示される
4. `ogp.image` が存在するとき `<img>` 要素がレンダリングされる
5. カードをクリックすると `openExternalLink(url)` が呼ばれる
6. `Enter` キーを押すと `openExternalLink(url)` が呼ばれる

## 4. 設計方針

- `vi.mock("../api/ogp.js", () => ({ useOgp: vi.fn() }))` で `useOgp` をモック
- `vi.mock("../hooks/useExternalLink.js", () => ({ useExternalLink: vi.fn() }))` で `useExternalLink` をモック
- `vi.mocked(useOgp).mockReturnValue(...)` / `vi.mocked(useExternalLink).mockReturnValue(...)` で各テストごとに返却値を注入
- `OgpCard` は `role="link"` の Box をレンダリングするため `screen.getByRole("link")` で取得可能
- `<Box component="img">` は `<img>` タグとして描画されるため `screen.getByRole("img")` で取得可能
- `userEvent.click()` でクリック、`userEvent.keyboard("{Enter}")` で Enter キー操作をシミュレート
- `afterEach(() => vi.resetAllMocks())` でモック状態をリセット

## 5. 影響範囲 / 既存への変更

- `client/src/components/OgpCard.test.tsx` を新規作成（他ファイルの変更なし）
- 対象ワークスペース: `client` のみ

## 6. テスト計画（TDDで書くテスト一覧）

1. `useOgp` の data が `undefined` のとき何もレンダリングされない
2. `ogp.title` が `null` のとき何もレンダリングされない
3. `ogp.title` が存在するときカード（role="link"）とタイトルが描画される
4. `ogp.image` が存在するとき `img` 要素が描画される
5. クリックで `openExternalLink(url)` が呼ばれる
6. Enter キーで `openExternalLink(url)` が呼ばれる

## 7. リスク・未決事項

- `Box component="img"` が JSDOM で `role="img"` を持つ `<img>` タグとして描画されることを前提とする
- `Box` の `role="link"` 属性は `<div role="link">` として描画されるため `screen.getByRole("link")` で取得可能
- `vi.mock` は Vitest の hoisting により import より前に処理されるため、ファイル先頭に記述する必要がある
