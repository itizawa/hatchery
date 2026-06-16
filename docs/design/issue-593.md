# 設計書: ワーカー追加 UI の表記「社員」を「ワーカー」に統一する (#593)

## 1. 目的 / 背景

concept.md はプロダクト内の表記を「Hatchery／ユーザー／AIワーカー／admin／community／定時」で統一すると規定している。
Employee→Worker リネーム（#329）後も管理 UI の追加側に旧表記「社員」が残存し、`EditWorkerDialog.tsx`（「ワーカー編集」）と画面内で不整合になっていた。

## 2. スコープ（やること / やらないこと）

**やること**:
- `AddWorkerDialog.tsx` のダイアログタイトル「社員を追加」を「ワーカーを追加」に変更
- `AdminWorkerTable.tsx` のボタンラベル・aria-label・コメント内の「社員」を「ワーカー」に変更
- 連動するユニットテスト（`AddWorkerDialog.test.tsx`・`AdminWorkerTable.test.tsx`・`SettingsScene.test.tsx`）の期待文字列を更新
- e2e spec（`e2e/admin/admin.spec.ts`）のロールセレクタ文字列を更新
- `e2e/admin/usecases.md` にボタン名を明示

**やらないこと**:
- `LandingScene.tsx`・`concept.md` の「AI 社員」という表記（意図的なナラティブ copy につき対象外）
- 機能的な動作変更（文言変更のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `grep -rn "社員" client/src/components/AddWorkerDialog.tsx client/src/components/AdminWorkerTable.tsx` が 0 件
2. `AddWorkerDialog.test.tsx`・`AdminWorkerTable.test.tsx`・`SettingsScene.test.tsx` の期待文字列が「ワーカーを追加」に統一されている
3. e2e admin spec がボタン名「ワーカーを追加」を参照している
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針

純粋な文言置換。ロジック変更なし。
- `AddWorkerDialog.tsx`: `DialogTitle` テキスト 1 箇所
- `AdminWorkerTable.tsx`: ボタン aria-label・テキスト・コメント 4 箇所

## 5. 影響範囲 / 既存への変更

- client: `AddWorkerDialog.tsx`、`AdminWorkerTable.tsx`、各テストファイル
- e2e: `admin/admin.spec.ts`、`admin/usecases.md`

## 6. テスト計画（TDD で書くテスト一覧）

既存テストの期待文字列を「ワーカーを追加」へ更新（実装変更前に更新してテストを失敗させてから実装を変更する）:
- `AddWorkerDialog.test.tsx`: ダイアログタイトルのアサーション
- `AdminWorkerTable.test.tsx`: ボタンの aria-label アサーション
- `SettingsScene.test.tsx`: ボタンの aria-label アサーション

## 7. リスク・未決事項

なし（文言のみの変更、機能への影響なし）。
