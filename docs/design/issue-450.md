# 設計書: fix: ANTHROPIC_API_KEY が空文字のとき loadEnv が ZodError で落ちて Cloud Run デプロイが失敗する (#450)

## 1. 目的 / 背景

GitHub Secrets の `ANTHROPIC_API_KEY` が未設定のとき、CI の `--set-env-vars="ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}"` が空文字を Cloud Run に渡す。
現在の `env.ts` は `z.string().min(1).optional()` を使っているため、`undefined` は通るが空文字 `""` は `min(1)` で弾かれて ZodError → `exit(1)` → コンテナ起動失敗となる。

`ANTHROPIC_API_KEY` はバッチのフォールバック用で、API サーバ（`server.ts`）は使わない。空文字は「未設定」として扱うのが正しい。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/config/env.ts` の `ANTHROPIC_API_KEY` スキーマを、空文字を `undefined` に変換するよう修正
- `server/src/config/env.test.ts` にテストを追加

**やらないこと:**
- GitHub Secrets / Workflow の変更（コード側の防御で十分）
- 他フィールド（SESSION_SECRET / APP_SECRET 等）の同様対応（今回スコープ外）
- client / common への変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `ANTHROPIC_API_KEY=""` を渡したとき `loadEnv` が ZodError を投げない
2. `ANTHROPIC_API_KEY=""` を渡したとき `env.anthropicApiKey === undefined`
3. `ANTHROPIC_API_KEY="sk-ant-api03-test"` を渡したとき `env.anthropicApiKey === "sk-ant-api03-test"`（既存テスト維持）
4. `ANTHROPIC_API_KEY` 未設定のとき `env.anthropicApiKey === undefined`（既存テスト維持）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`CORS_ALLOWED_ORIGINS` と同じパターンを踏襲し、`.optional().transform()` で空値を undefined に変換する。

```ts
ANTHROPIC_API_KEY: z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined)),
```

これにより:
- `undefined` → transform → `undefined` ✅
- `""` → transform → `undefined` ✅（ZodError なし）
- `"sk-ant-api03-test"` → transform → `"sk-ant-api03-test"` ✅

## 5. 影響範囲 / 既存への変更

- `server/src/config/env.ts`: `ANTHROPIC_API_KEY` スキーマ変更（1 行）
- `server/src/config/env.test.ts`: テスト追加（1 ケース）
- client / common: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

- `ANTHROPIC_API_KEY=""` で `loadEnv` が throw せず `env.anthropicApiKey` が `undefined` であること

## 7. リスク・未決事項

- なし。他の `z.string().min(1).optional()` フィールドも同様の脆弱性を持つが、今回は `ANTHROPIC_API_KEY` のみ修正する（Issue スコープ）。
