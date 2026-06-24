# 設計書: e2e/ranking の UC-RANK-01〜03 を Playwright テストとして実装する (#787)

## 1. 目的 / 背景

`e2e/ranking/ranking.spec.ts` は `test.todo()` スケルトンのままで、ランキング画面の Playwright テストが未実装。
`e2e/ranking/usecases.md` に定義済みの UC-RANK-01〜03 をすべて実テストに置き換える。

## 2. スコープ（やること / やらないこと）

**やること:**
- `e2e/ranking/ranking.spec.ts` の `test.todo` 3 件を実テストに置き換える
- `page.route()` で `/api/workers/ranking` をモックし、バックエンドなしで検証する

**やらないこと:**
- ランキング集計ロジックのサーバ単体テスト（スコープ外、Issue 本文に明記）
- `e2e/ranking/usecases.md` の内容変更（受け入れ条件と整合済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-RANK-01: サイドバーの「ランキング」リンクをクリックすると URL が `/ranking` になり、「ワーカーランキング」の見出しが表示される
2. UC-RANK-02: `/ranking` で `/api/workers/ranking` が workers データを返すとき、テーブルに表示名・閲覧数・評価（+N/−N）と順位番号が表示される
3. UC-RANK-03: `/api/workers/ranking` が空配列を返すとき「まだランキングデータがありません。」が表示され、テーブル行は表示されない
4. `pnpm turbo run build lint` が緑
5. Playwright の ranking spec が通る

## 4. 設計方針

- 参照実装として `e2e/auth/auth.spec.ts`・`e2e/community/community.spec.ts` を踏襲
- `page.route("**/api/workers/ranking", ...)` で API をモック
- `**/api/auth/me` は 401 モック（認証不要ページのためゲスト状態でテスト）
- `**/api/communities` は空配列モックでサイドバー描画を安定させる

## 5. 影響範囲 / 既存への変更

- 変更: `e2e/ranking/ranking.spec.ts`（`test.todo` → 実テスト）
- 追加なし（usecases.md は整合済みのため変更不要）

## 6. テスト計画

| テスト | 検証内容 |
|--------|----------|
| UC-RANK-01 | サイドバー「ランキング」クリック → `/ranking` 遷移・見出し表示 |
| UC-RANK-02 | データあり → テーブル行・順位番号・閲覧数・評価スコア（+N 緑/−N 赤）表示 |
| UC-RANK-03 | データなし → 空状態メッセージ・テーブル行なし |

## 7. リスク・未決事項

- なし（実装のみ。ロジック変更なし）
