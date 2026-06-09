# 設計書: ADR — goal=issue のリサーチャーエンジンに Claude Agent SDK を採用する (#287)

## 1. 目的 / 背景

`goal=issue`（リサーチャー）バッチは、Web 調査と GitHub 操作をツール使用ループで回すエージェント的ワークロードである。現状の `@anthropic-ai/sdk` 直接呼び出し（単発・インプロセス）では実装が手書きになり、自律性・拡張性が乏しい。

`@anthropic-ai/claude-agent-sdk` はヘッドレス実行・`WebSearch`/`WebFetch`・MCP を標準で扱い、`maxTurns`/予算上限でコストを束ねられる。この採用決定を ADR として記録し、`goal=chat`（発言生成）との二エンジン方針を確定する。

## 2. スコープ（やること / やらないこと）

### やること

- `docs/adr/0017-adopt-claude-agent-sdk-for-researcher.md` の作成（ADR-0004 増補）
- `docs/adr/README.md` の一覧表への行追加

### やらないこと

- 実装コード（#285 のスコープ）
- `concept.md` の直接書き換え（ADR にコスト概念の更新への言及を記す形で対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `docs/adr/0017-adopt-claude-agent-sdk-for-researcher.md` が `docs/adr/template.md` 準拠で存在する
2. ADR の決定として以下が明記されている:
   - `goal=issue` → `@anthropic-ai/claude-agent-sdk` / `goal=chat` → `@anthropic-ai/sdk`（単発）の二エンジン方針
   - 認証は `ANTHROPIC_API_KEY`（既存 `getApiKey()` と整合）
   - 実行形態はヘッドレスバッチ（Cloud Run・ADR-0011）、サブプロセス約 1GiB RAM、セッションはエフェメラル
   - ツール/権限は `permissionMode: "dontAsk"` + `allowedTools` を `WebSearch`/`WebFetch`/GitHub Issue 作成に限定
   - コスト制御は `maxTurns` + `max_budget_usd`
   - 起票の決定性担保: 自前ラッパー経由・重複防止・1 run 最大 N 件を方針として記す
3. `docs/adr/README.md` の一覧表に ADR-0017 の行が追加されている
4. ADR-0004・ADR-0011・ADR-0009・ADR-0016・concept.md への相互参照が記されている
5. `pnpm turbo run build test lint` が緑（ドキュメントのみの変更）

## 4. 設計方針

ドキュメントのみ。ADR フォーマット（`template.md` 準拠）で記述する。

二エンジン方針の根拠:
- `goal=chat`: 1 定時 1 コール、JSON 配列で複数 message を一括生成。ツールループ不要でシンプル。既存 `@anthropic-ai/sdk` の `messages.create` が最適。
- `goal=issue`: ツール使用ループ（Web 調査 → 分析 → Issue 起票）が必要。`claude-agent-sdk` の `query()` でエージェント的に実行。

## 5. 影響範囲 / 既存への変更

- 追加: `docs/adr/0017-adopt-claude-agent-sdk-for-researcher.md`（新規）
- 変更: `docs/adr/README.md`（1 行追加）
- コード変更なし

## 6. テスト計画

ドキュメントのみのため新規テスト追加なし。既存テスト・lint が全緑であることを確認する。

## 7. リスク・未決事項

- `@anthropic-ai/claude-agent-sdk` のバージョン安定性は実装時（#285）に確認する
- 1 run あたりの具体的な `maxTurns` / `max_budget_usd` の値は #285 実装・実測時に決定する
