# 設計書: Issue #471 — バッチ AI 生成の max_tokens 定数の集約

## 背景・目的

`server/src/batch/aiMessageGenerator.ts` の AI 生成まわりに max_tokens のマジックナンバーが直書きされている。値の意図と変更箇所を明確にするため、名前付き定数へ集約する（挙動不変のリファクタ）。

なお現状コードでは会話生成の `8192` は既に `CONVERSATION_MAX_TOKENS` 定数として切り出し済み。残っているのはあらすじ生成の `512` の直書き（`generateSummaryWithClaude` の `callClaudeText(..., 512)`）のみ。本 Issue ではこれを `SUMMARY_MAX_TOKENS` に切り出し、両定数に意図コメントを揃える。

## 受け入れ条件 → 入出力

| 受け入れ条件 | 対応 |
|---|---|
| 1. `8192`/`512` を名前付き定数化し意図コメントを添える | `CONVERSATION_MAX_TOKENS`（既存・コメント補強で #401 の経緯を明記）/ `SUMMARY_MAX_TOKENS`（新規）に置換 |
| 2. 既存テスト（`aiMessageGenerator.test.ts`）が緑 | テストは値（4096 以上 / 512）を検証しており、定数化で値は不変のため緑を維持 |
| 3. 値そのものは変えない（挙動不変） | `8192` / `512` の数値は据え置き、参照のみ定数経由に変更 |
| 4. `pnpm turbo run build test lint` が緑 | ローカルで確認 |

## 設計判断

- **新規定数 `SUMMARY_MAX_TOKENS = 512`** を `CONVERSATION_MAX_TOKENS` の直下に置き、あらすじ生成は短文要約のため小さめに取る旨をコメントで明示。
- **`CONVERSATION_MAX_TOKENS` のコメントを補強**し、#401 で会話生成の max_tokens 不足による JSON 切り詰めを修正した経緯（切り詰め回避のため大きめ）を意図として残す。
- 値は据え置きでテスト不変。リファクタのため新規テストは追加せず、既存テスト緑で挙動不変を担保する（TDD: 既存テストが「値が変わらない」仕様の回帰テストとして機能する）。
- スコープ外: モデル名 `MODEL` の扱い・Batches API コスト削減（#389）・`DEFAULT_RECENT_LIMIT`（既に定数化済み）には踏み込まない。

## ユーザー可視の振る舞い

なし（純粋なサーバ内部リファクタ）。`e2e/` の usecases 更新不要。
