# 設計書: client/src/api/ogp.ts（fetchOgp / useOgp）のテストを追加する (#712)

## 1. 目的 / 背景

`client/src/api/ogp.ts` の `fetchOgp` 関数と `useOgp` カスタムフックはユニットテストが存在しない。
OGP メタデータ取得の成功・エラーパス、および TanStack Query フックの `enabled` 制御を確認するテストを追加し、回帰保護を整える。

## 2. スコープ（やること / やらないこと）

**やること**

- `fetchOgp(url)` の正常系テスト（API 成功 → OGP メタデータを返す）
- `fetchOgp(url)` の異常系テスト（API 4xx/5xx → null 埋め OgpMeta を返す）
- `useOgp(null)` のテスト（url が null → GET /api/ogp を呼ばない）
- `useOgp(url)` のテスト（url が文字列 → GET /api/ogp?url= を呼ぶ）

**やらないこと**

- `OgpCard` コンポーネント（Issue #711 で完了済み）
- サーバサイドの OGP エンドポイント実装の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `fetchOgp(url)` において API が 200 を返したとき、レスポンス JSON の OGP メタデータを返す
2. `fetchOgp(url)` において API が 4xx/5xx を返したとき、`{ title: null, description: null, image: null, site_name: null }` を返す
3. `useOgp(null)` において `url` が `null` のとき、GET /api/ogp へのリクエストを発行しない
4. `useOgp(url)` において `url` が文字列のとき、GET /api/ogp?url=<url> へのリクエストを発行する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### fetchOgp テスト

`openApiClient` は内部で `fetch` を呼ぶ。コードベース全体で採用している `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(...))` パターンを使用する（MSW は不使用）。

- 成功系: `new Response(JSON.stringify(ogpData), { status: 200, headers: { "Content-Type": "application/json" } })`
- 失敗系: `new Response(null, { status: 404 })` → null 埋めオブジェクトを期待

### useOgp テスト

TanStack Query の `useQuery` は `enabled: url != null` で制御される。テストには `renderHook` + `QueryClientProvider` ラッパーを使用する。

- `useOgp(null)`: `waitFor` で `isLoading === false` を確認し、fetch モックが呼ばれていないことをアサート
- `useOgp(url)`: `waitFor` で `isSuccess === true` を確認し、fetch モックが呼ばれていることをアサート

`QueryClient` は `retry: false` / `gcTime: 0` で生成してテスト間を隔離する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- **追加**: `client/src/api/ogp.test.ts`（新規）
- **変更なし**: `client/src/api/ogp.ts`（既存実装は変更しない）

## 6. テスト計画（TDDで書くテスト一覧）

| # | describe | テストケース |
|---|----------|-----------|
| 1 | `fetchOgp` | 200 のとき OGP メタデータを返す |
| 2 | `fetchOgp` | 404 のとき null 埋め OgpMeta を返す |
| 3 | `fetchOgp` | 500 のとき null 埋め OgpMeta を返す |
| 4 | `useOgp` | url が null のとき fetch を呼ばない |
| 5 | `useOgp` | url が文字列のとき fetch を呼ぶ |

## 7. リスク・未決事項

- `openApiClient` のベース URL はテスト環境でも絶対 URL 形式（`http://localhost/api/ogp?url=...`）になるため、URL 含有チェックには `toContain` を使用する。
- `useOgp` のフック内部で `fetchOgp` が呼ばれるが、`fetchOgp` は `openApiClient` を経由するため、`fetch` の stub でフック全体をカバーできる。
