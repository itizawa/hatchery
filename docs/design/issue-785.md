# 設計書: client/src/api/communities.ts の admin 系関数テスト追加 (#785)

## 1. 目的 / 背景

`client/src/api/communities.ts`（260 行）は多数の関数を export しているが、`communities.test.ts`（66 行）は `fetchPublicCommunities` と後方互換 re-export しか検証していない。

admin 系の中核経路（`fetchAdminCommunities` / `createCommunity` / `updateCommunity` / `uploadCommunityImage` / `fetchRecentWorkers`）が壊れても静かに失敗するリスクがあるため、テストで挙動を固定する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/api/communities.test.ts` に 5 関数のテストを追加（正常応答・エラー応答の各 2 ケース）
- 既存テストは一切変更しない

### やらないこと
- TanStack Query フック（`useCreateCommunity` / `useUpdateCommunity` 等）の結合テスト
- `communities.ts` 実装コードの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `fetchAdminCommunities`: 200 応答で `AdminCommunity[]` を返す / エラー応答（403 等）で例外を投げる
2. `createCommunity`: 200 応答で作成した `AdminCommunity` を返す / エラー応答（400 等）で例外を投げる
3. `updateCommunity`: 200 応答で更新後の `AdminCommunity` を返す / エラー応答（404 等）で例外を投げる
4. `fetchRecentWorkers`: 200 応答で `RecentWorker[]` を返す / エラー応答（404 等）で例外を投げる
5. `uploadCommunityImage`: multipart リクエスト（`FormData`）が送信され、200 応答で更新後データを返す / エラー応答（400 等）で例外を投げる
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### モック戦略

- **`openApiClient` 経由の関数**（`fetchAdminCommunities` / `createCommunity` / `updateCommunity`）:
  - `openApiClient` は `fetch: (...args) => globalThis.fetch(...args)` で呼び出し時に `globalThis.fetch` を解決するよう設計済み（`client.ts` コメント参照）。
  - `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(...)))` でモック可能。
  - リクエスト検証: `fetchMock.mock.calls[0][0] as Request` で Request オブジェクトを取り出して `.url` / `.method` を確認する。

- **raw `fetch` 呼び出しの関数**（`fetchRecentWorkers` / `uploadCommunityImage`）:
  - 直接 `fetch(url, init)` を呼ぶため、`fetchMock.mock.calls[0]` は `[url: string, init: RequestInit]`。
  - `[url]` で URL 文字列を取り出して `toContain` で検証する。

### テストデータ

`AdminCommunity` は `AdminCommunitySchema`（Zod）で検証されるため、`created_at` を string で API レスポンスに含め、関数が `new Date(...)` に変換してから parse する流れに合わせたモックデータを用意する。

### エラーレスポンス

openapi-fetch はエラー応答の body を JSON として parse しようとする場合があるため、エラーレスポンスにも `{ error: "..." }` ボディを含めることで parse 失敗による誤ったエラーを避ける。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/src/api/communities.test.ts` | テスト追加（import 拡張 + describe ブロック追加） |
| `docs/design/issue-785.md` | 本設計書（新規） |

## 6. テスト計画（TDD で書くテスト一覧）

| 関数 | ケース | 検証内容 |
|------|--------|----------|
| `fetchAdminCommunities` | 200 | 配列長・id・created_at が Date・URL・メソッド |
| `fetchAdminCommunities` | エラー(403) | 例外を投げる |
| `createCommunity` | 200 | id・created_at が Date・URL・メソッド |
| `createCommunity` | エラー(400) | 例外を投げる |
| `updateCommunity` | 200 | id・変更後 name・created_at が Date・URL・メソッド |
| `updateCommunity` | エラー(404) | 例外を投げる |
| `fetchRecentWorkers` | 200 | 配列長・id・URL |
| `fetchRecentWorkers` | エラー(404) | 例外を投げる |
| `uploadCommunityImage` | 200 | id・iconUrl・URL・メソッド・body が FormData |
| `uploadCommunityImage` | エラー(400) | 例外を投げる |

## 7. リスク・未決事項

- なし（スコープが明確で、参照実装パターンが存在する）
