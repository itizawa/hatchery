# 設計書: e2e/legal の UC-LEGAL-01〜04 を Playwright テストとして実装する (#739)

## 1. 目的 / 背景

`e2e/legal/legal.spec.ts` の全 4 件が `test.todo()` のまま未実装で、利用規約・プライバシーポリシーページの
ブラウザ上の動作確認がない状態。`/release-check` の検証対象に含まれるため、未実装のままでは検証漏れが生じる。

## 2. スコープ（やること / やらないこと）

**やること:**
- UC-LEGAL-01〜04 の `test.todo()` を実テストに置き換える

**やらないこと:**
- 利用規約・プライバシーポリシーの文書内容の更新
- CI への e2e 組み込み（playwright.config.ts に明記済みのスコープ外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-LEGAL-01: 未認証状態で `/terms` を開いたとき、URL が `/terms` のまま（リダイレクトなし）で「利用規約」見出しが表示される
2. UC-LEGAL-02: 未認証状態で `/privacy` を開いたとき、URL が `/privacy` のまま（リダイレクトなし）で「プライバシーポリシー」見出しが表示される
3. UC-LEGAL-03: `/terms` のサイドバーから「プライバシーポリシー」リンクをクリックすると `/privacy` に遷移し、逆方向（`/privacy` → 「利用規約」）も同様に遷移できる
4. UC-LEGAL-04: `/terms` に「暫定（ドラフト）の文言」の注記が表示され、`/privacy` にも同様の注記が表示される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### API モック方針

法的ページは静的コンテンツのみで API 呼び出しを持たないが、RootLayout（サイドバー）が以下の API を呼ぶため
モックが必要:

- `GET **/api/auth/me` → 401（未認証状態）
- `GET **/api/communities` → `[]`（空リスト: サイドバーのコミュニティ一覧）

### テスト構造

既存の `e2e/auth/auth.spec.ts` パターンを踏襲:
- `mockUnauthenticated(page)`: `/api/auth/me` を 401 にモック
- `mockCommunities(page)`: `/api/communities` を `[]` にモック
- 各テストで `import { test, expect } from "../support/test.js"` を使用

### UC-LEGAL-03 の実装方針

サイドバーリンクは `RootLayout.tsx` の `SidebarContent` に常時表示される（未ログイン含む全ユーザー対象）。
`/terms` から「プライバシーポリシー」リンクをクリック、`/privacy` から「利用規約」リンクをクリックして
双方向の遷移を確認する。

## 5. 影響範囲 / 既存への変更

- 変更ファイル: `e2e/legal/legal.spec.ts`（1 ファイルのみ）
- `e2e/legal/usecases.md` の内容と整合済みのため更新不要

## 6. テスト計画（TDD で書くテスト一覧）

| テスト名 | 検証内容 |
|---------|----------|
| UC-LEGAL-01 | `/terms` が未認証で閲覧可能・「利用規約」見出し表示 |
| UC-LEGAL-02 | `/privacy` が未認証で閲覧可能・「プライバシーポリシー」見出し表示 |
| UC-LEGAL-03 | サイドバーリンクから `/terms` ↔ `/privacy` 双方向遷移 |
| UC-LEGAL-04 | 暫定ドラフト注記テキストが `/terms` / `/privacy` 双方で表示 |

## 7. リスク・未決事項

- e2e テストは `pnpm turbo run build lint test` には未組み込み（playwright.config.ts に明記済み）。本テストは `pnpm e2e` でのみ実行可能。
- サイドバーの API エラー時の縮退表示（QueryBoundary の errorFallback）によりリンクが消える可能性があるが、モックで正常レスポンスを返すため問題なし。
