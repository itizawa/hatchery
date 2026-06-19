# 設計書: GitHub Release ノート冒頭に pnpm バナーが混入する問題を修正 (#735)

## 1. 目的 / 背景

`.github/workflows/release-tag.yml` の「Generate AI release notes」ステップで、
`pnpm --filter @hatchery/server release-notes ...` を実行した際に pnpm のスクリプト実行バナー
（`> @hatchery/server@0.0.0 release-notes /path/` と `> tsx ...` の 2 行）が
**stdout に出力**され、`ai_notes` に混入する。

GitHub Markdown では `>` 始まりの行は blockquote として描画されるため、
Release 本文の先頭にコミット一覧が引用ブロックとして表示される問題が起きていた。

ワークフローのコメント（L131）には「stderr に出るため 2>&1 は使わない」と誤った前提が書かれているが、
実際には pnpm バナーは stdout に出力される。

## 2. スコープ（やること / やらないこと）

**やること:**
- `release-tag.yml` の pnpm release-notes 実行を `pnpm --silent` 付きに変更
- L131 の誤コメントを修正（"stderr" → "stdout" の誤認を除去し正確な説明に）
- `tests/release-tag-workflow.test.ts` に AC4 のテストを追加

**やらないこと:**
- AI リリースノートの本文フォーマット改善
- 過去の汚染済み Release の修正
- server スクリプト本体の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `pnpm` の `release-notes` 実行コマンド行に `--silent` フラグが含まれること
2. `ai_notes` には `> @hatchery/server@...` / `> tsx ...` のバナー行が含まれないこと（--silent が保証）
3. AI 生成失敗時のフォールバック（`continue-on-error: true` + exit 1）挙動が維持されること
4. `tests/release-tag-workflow.test.ts` に「pnpm バナー抑制フラグが含まれる」テストを追加
5. `.github/workflows/release-tag.yml` と `tests/release-tag-workflow.test.ts` のみを変更

## 4. 設計方針

`pnpm --silent` フラグ（`-s` のエイリアス）を pnpm コマンドに追加するのが最小変更。
`--silent` は pnpm v8+ で安定してサポートされており、スクリプト実行バナーを stdout へ出力しない。

## 5. 影響範囲

- `.github/workflows/release-tag.yml`（L131 コメント、L133 pnpm コマンド）
- `tests/release-tag-workflow.test.ts`（テスト追加）

## 6. テスト計画（TDD）

新規テスト（`tests/release-tag-workflow.test.ts`）:
- `pnpm バナーを抑制した方法で release-notes を呼んでいる` describe ブロックに追加
  - `release-notes の pnpm 実行に --silent フラグが含まれる` it
  
既存テスト: 変更なし、引き続き緑。

## 7. リスク・未決事項

- pnpm --silent は GitHub Actions の pnpm バージョン（action-setup v6 が使う）で安定動作確認済みと想定
- `pnpm test:repo`（`tests/` を実行するスクリプト）で新規テストが緑になることを確認する
