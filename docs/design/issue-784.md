# 設計書: WorkerRankingScene のコンポーネントテスト追加 (#784)

## 1. 目的 / 背景

`client/src/routes/WorkerRankingScene.tsx`（/ranking・#665 / ADR-0032）は `client/src/routes/` 配下の唯一テストが存在しないシーン。表示分岐（順位・スコア符号・空状態）をテストで固定し、リグレッションを防ぐ。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/routes/WorkerRankingScene.test.tsx` を新設する
- `useWorkerRanking` をモックしてユニットレベルで描画テスト
- スコア符号分岐（`+`/`-` プレフィックスと color 出し分け）のテストと実装修正

**やらないこと:**
- e2e テスト（UC-RANK は別 Issue #787 で Playwright 実装）
- Router / 認証フローのテスト（WorkerRankingScene は認証不要の公開ページ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `WorkerRankingScene.test.tsx` が新設されている。
2. `useWorkerRanking` をモックし、複数ワーカーを渡したとき順位番号・表示名・閲覧数（`toLocaleString` 済み）・スコアが表示される。
3. `vote_net_score >= 0` のとき `+N` テキストが `data-testid="score-positive"` セルで表示される。`vote_net_score < 0` のとき `-N` テキストが `data-testid="score-negative"` セルで表示される。
4. `data` が空配列のとき `data-testid="ranking-empty"` の空状態要素が表示される。
5. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

- **モック戦略**: `vi.mock("../api/workers.js")` で `useWorkerRanking` をモック。内部 Suspense を回避。
- **レンダリングヘルパ**: `QueryClientProvider` のみ（ThemeProvider は不要）。`retry: false` で即時解決。
- **color 分岐テスト**: `RankingRow` に `data-testid="score-positive"` / `"score-negative"` を追加し、テキスト内容で検証する。同時に `sx.color` も `success.main` / `error.main` に変更（実装が伴う分岐）。これによりテストは TDD の red→green サイクルを踏む。

## 5. 影響範囲

- `client/src/routes/WorkerRankingScene.tsx` — `RankingRow` に `data-testid` + `sx.color` 追加（軽微な修正）
- `client/src/routes/WorkerRankingScene.test.tsx` — 新設（28 行程度）

## 6. テスト計画

| # | テスト名 | 期待動作 |
|---|---------|---------|
| T1 | 複数ワーカーの描画 | 順位・表示名・閲覧数・スコアが全表示される |
| T2 | 正スコアの `+` プレフィックス | `score-positive` セルに `+5` が表示 |
| T3 | 負スコアの `-` プレフィックス | `score-negative` セルに `-3` が表示 |
| T4 | 空状態 | `ranking-empty` が表示される |

## 7. リスク・未決事項

- `useSuspenseQuery` モック: `vi.mock` で直接 `{ data: [...] }` を返せばフック呼び出しは解決する（Suspense は発火しない）。
- `toLocaleString()` の出力はロケール依存。jsdom のデフォルトロケール（en-US）では `1,234` 形式になる。テストはこの形式で記述する。
