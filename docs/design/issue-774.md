# 設計書: issue-774 — /ranking の文言を「評価スコア」ベースの日本語に統一

## 概要

`/ranking`（WorkerRankingScene.tsx）の評価指標の文言を、英語混じりの `Vote スコア` から
日本語ユーザーに通じる「評価」ベースの表現に統一する。
あわせて、負値の `error.main`（赤）表示をエラーと誤読されない中立色に変更する。

## 変更範囲

- `client/src/routes/WorkerRankingScene.tsx` のみ（UIの文言・色の変更）
- `e2e/ranking/usecases.md`（UC-RANK-02 の文言アサーション更新）
- `e2e/usecases.md`（サマリ更新）
- `client/src/routes/WorkerRankingScene.test.tsx`（新規テスト追加）

スコープ外: 集計ロジック・API・スキーマ・内部識別子 (`vote_net_score`) は変更しない。

## 受け入れ条件の実装計画

| 受け入れ条件 | 対応 |
|---|---|
| 列見出しを「Vote スコア（7日）」→「評価（7日）」に変更 | `WorkerRankingScene.tsx:78` のテキストを変更 |
| 説明文を「賛成から反対を引いた評価スコア」に変更 | `WorkerRankingScene.tsx:108` のテキストを変更 |
| 負値の色を `error.main` → 中立色（`text.secondary`）に変更 | `WorkerRankingScene.tsx:43` の sx.color を変更 |
| aria-label との矛盾なし | `aria-label="ワーカーランキング"` は変更不要 |
| テストを追加して TDD | `WorkerRankingScene.test.tsx` を新規作成 |
| e2e ユースケース更新 | `e2e/ranking/usecases.md` UC-RANK-02 を更新 |

## 設計判断

- 負値スコアの色: `success.main`/`error.main` 対比は「良い/悪い」という価値判断を与え、
  かつ `error.main` が UI エラーと誤読される。Issue の提案通り `text.secondary` を採用し、
  正値・負値ともに `text.secondary` に統一して中立的に表示する。符号付き表示 (`+5`/`-3`) は維持。
- 列見出し: 「Vote スコア（7日）」を「評価（7日）」に短縮。`（7日）` の括弧表記は閲覧数列と
  統一感があるので維持。
- 説明文: 「純 Vote スコア（up − down）」を「賛成から反対を引いた評価スコア」に置き換え。

## TDD 方針

1. `WorkerRankingScene.test.tsx` に以下を検証するテストを書く:
   - 新列見出し「評価（7日）」が表示されること
   - 新説明文「賛成から反対を引いた評価スコア」が含まれること
   - 正値スコアに `+` プレフィックスが付くこと
   - 負値スコアがエラー系の色でなく中立色で表示されること（aria-label ベースで確認）
   - 空状態「まだランキングデータがありません。」の表示
2. テスト失敗を確認してコミット
3. `WorkerRankingScene.tsx` を変更してテストを通す
