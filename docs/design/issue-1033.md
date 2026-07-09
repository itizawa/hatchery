# 設計書: ExternalLinkDialog.tsx の URL パース失敗時フォールバック分岐のテストを追加する (#1033)

## 1. 目的 / 背景

`client/src/components/ExternalLinkDialog.tsx` は遷移先ホスト名を表示する際、`new URL(url).host` が失敗した場合に `url`（フル URL 文字列）をそのまま表示する `catch` フォールバックを持つ。既存の `ExternalLinkDialog.test.tsx`（Issue #661）は有効な URL のみでテストしており、この `catch` 分岐は一度も実行されていない（`client/coverage/coverage-summary.json` で branches 66.7%）。この未検証分岐にテストを追加し、不正な URL 文字列が渡されてもコンポーネントがクラッシュせず妥当な表示になることを CI で保証する。

## 2. スコープ（やること / やらないこと）

- やること: `ExternalLinkDialog.test.tsx` に、`new URL()` でパース失敗する `url`（例: `"not-a-valid-url"`）を渡し、例外を投げずにレンダリングされ `displayHost` としてフル URL 文字列が表示されることを検証するテストケースを追加する。
- やらないこと: URL バリデーション仕様自体の変更（不正 URL の場合にダイアログを表示しない等）。`ExternalLinkDialog.tsx` の実装は変更しない（既存の try/catch フォールバック挙動は正しく動作しているため、コンポーネント実装の修正は不要）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `url` に `new URL()` でパース失敗する文字列（`"not-a-valid-url"`）を渡した場合、`ExternalLinkDialog` が例外を投げずにレンダリングされる。
2. 上記ケースで `displayHost` としてフル URL 文字列（渡した不正な文字列そのもの、`"not-a-valid-url"`）が画面に表示される。
3. 追加後、`ExternalLinkDialog.tsx` の branches カバレッジが現状値（66.7%）を上回る。
4. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 既存の `ExternalLinkDialog.test.tsx`「表示内容」describe ブロックのテストパターン（`render` → `screen.getByText` でアサーション）を踏襲する。
- 新規テストケースを「表示内容」describe 内に追加し、`url="not-a-valid-url"` を渡してレンダリングし、`screen.getByText("not-a-valid-url")` で表示を検証する。
- 実装（`ExternalLinkDialog.tsx`）は変更しない。テスト追加のみ。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- 対象ワークスペース: `client`（テストのみ）。
- `client/src/components/ExternalLinkDialog.test.tsx` にテストケースを 1 件追加。
- `client/src/components/ExternalLinkDialog.tsx` の変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

- `ExternalLinkDialog.test.tsx`「表示内容」ブロックに以下を追加:
  - 「URL パースに失敗する場合、フル URL 文字列がそのまま表示される」: `url="not-a-valid-url"` でレンダリングし、例外が投げられないこと・`"not-a-valid-url"` がテキストとして表示されることを検証する。

## 7. リスク・未決事項

- 特になし。既存コンポーネントの未検証分岐へのテスト追加のみで、実装変更や UI 上のユーザー可視の振る舞い変更はない。
