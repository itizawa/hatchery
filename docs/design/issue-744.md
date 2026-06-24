# 設計書: e2e/admin UC-ADMIN-15 Playwright テスト実装 (#744)

## 1. 目的 / 背景

`e2e/admin/admin.spec.ts:611` に `test.todo()` のまま未実装の UC-ADMIN-15 を実テストに置き換える。
verbosity（簡潔 / 標準 / 詳細）はワーカーの生成品質に直接影響するため、管理画面での設定が正しく動作することを自動検証する。

## 2. スコープ（やること / やらないこと）

やること:
- `test.todo("UC-ADMIN-15...")` を実テストに書き換える
- verbosity の変更 → 保存 → PATCH API 呼び出しを検証する
- 再開ダイアログで変更後の値が反映されていることを検証する
- verbosity 未設定ワーカーの初期値が「標準」であることを検証する

やらないこと:
- verbosity 設定が実際の生成プロンプトに反映される動作確認（バッチの e2e は別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. admin ユーザーが Worker 編集ダイアログを開くと、verbosity 未設定のワーカーは「標準」が初期選択になる。
2. 「詳細」を選択して保存すると、PATCH `/api/workers/:id` が `{ verbosity: "detailed" }` を含むボディで呼ばれる。
3. 保存成功後にダイアログが閉じる。
4. 再度同じ Worker の編集を開くと、「詳細」が選択状態で表示される（永続化）。
5. `pnpm turbo run build lint test` が緑。

## 4. 設計方針

- 既存テストパターン（UC-ADMIN-08, UC-ADMIN-12）に倣い、`page.route()` で API をモックする。
- MUI Select の操作は `getByRole("combobox", { name: /文章量/ })` でクリックし、`page.getByRole("option", { name: "詳細" })` で選択する（既存テストの combobox パターン）。
- 保存後の永続化検証は: PATCH 後にモックを更新し、再度編集ダイアログを開いて Select の値を確認する。

## 5. 影響範囲

- `e2e/admin/admin.spec.ts`: `test.todo()` を実テストに書き換える（1 テスト追加）

## 6. テスト計画（TDDで書くテスト一覧）

- UC-ADMIN-15: admin ユーザーが Worker の文章量（verbosity）を編集できる

## 7. リスク・未決事項

なし
