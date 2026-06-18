# 設計書: client/src/components/TextWithLinks.tsx の URL 変換ロジックのユニットテストを追加する (#710)

## 1. 目的 / 背景

`client/src/components/TextWithLinks.tsx` は post / comment 本文中の `http(s)://` URL を外部リンク確認モーダル経由で開くリンクに変換する重要なコンポーネントだが、対応するテストファイルが存在しない。URL 抽出の正規表現・末尾句読点除去・React 要素組み立て・`openExternalLink` 呼び出しは回帰リスクが高いため、RTL テストでカバーする。

## 2. スコープ（やること / やらないこと）

やること:
- `client/src/components/TextWithLinks.test.tsx` を新規作成
- URL を含まないテキストの表示確認
- `https://` URL がリンク要素として描画されることの確認
- 日本語句読点（`。、`等）が URL 末尾に続く場合、句読点が URL から切り離されることの確認
- リンククリックで `openExternalLink` が正しい URL と共に呼ばれることの確認
- 複数 URL が含まれる場合のそれぞれリンク化の確認
- `useExternalLink` は `vi.mock` でモックして `openExternalLink` の呼び出しを検証

やらないこと:
- `ExternalLinkDialog` 自体のテスト（既存の `ExternalLinkDialog.test.tsx` で対応済み）
- `useExternalLink` / `isExternalUrl` のテスト（Issue #717 で対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. URL を含まないテキストはそのまま表示される
2. テキスト中の `https://` URL がリンク要素として描画される
3. URL の末尾に日本語句読点（`。`）が続く場合、句読点は URL から切り離されてリンクに含まれない
4. リンクをクリックすると `openExternalLink` が呼ばれ、`href` はそのまま渡される
5. 複数 URL が含まれるテキストでそれぞれリンクになる

## 4. 設計方針

- `vi.mock("../hooks/useExternalLink.js", () => ({ useExternalLink: vi.fn() }))` でフックをモック
- `vi.mocked(useExternalLink).mockReturnValue({ openExternalLink })` で各テストごとにスパイを注入
- MUI `Link` コンポーネントは `<a>` タグとして描画されるため `screen.getByRole("link")` で取得可能
- `userEvent.click()` でクリックをシミュレートし `openExternalLink` の呼び出しを確認
- `afterEach(() => vi.restoreAllMocks())` でスパイをクリア

## 5. 影響範囲 / 既存への変更

- `client/src/components/TextWithLinks.test.tsx` を新規作成（他ファイルの変更なし）
- 対象ワークスペース: `client` のみ

## 6. テスト計画（TDDで書くテスト一覧）

1. URL を含まないテキストはそのまま表示される
2. https:// URL がリンク要素として描画される（href・テキストが一致）
3. URL 末尾に `。` が続く場合、句読点は URL に含まれない
4. リンククリックで `openExternalLink(url)` が呼ばれる
5. 複数 URL が含まれる場合にそれぞれリンクになる

## 7. リスク・未決事項

- `Link` コンポーネント（MUI v6）が `role="link"` の `<a>` タグとして描画されることを前提とする（既存テストで確認済みのパターン）
- `vi.mock` はファイル先頭（import より前）に配置する必要があるため、Vitest の hoisting に従う
