# 設計書: server/package.json から未使用の @anthropic-ai/claude-agent-sdk 依存を削除する（ADR-0023準拠） (#1031)

## 1. 目的 / 背景

`server/package.json` に `@anthropic-ai/claude-agent-sdk` (`^0.3.169`) が依存として残っているが、`server/src` / `mcp/src` のいずれからも参照されていない。`docs/adr/0023-simplify-to-pure-conversation-observation.md` の決定 (b) は「`@anthropic-ai/claude-agent-sdk` は採用しない」と明言しており、ADR の決定と実装（依存関係）が食い違っている状態を解消する。

## 2. スコープ（やること / やらないこと）

### やること

- `server/package.json` の `dependencies` から `@anthropic-ai/claude-agent-sdk` を削除する。
- `pnpm install` で `pnpm-lock.yaml` を更新する。
- 依存削除後も `server/src` / `mcp/src` に参照が無いことを再確認する。
- `pnpm turbo run build|test|lint` が緑であることを確認する。

### やらないこと

- `@anthropic-ai/sdk`（単発コール用、採用継続）は変更しない。
- ADR の新規追加・更新は行わない（既存 ADR-0023 の決定に実装を追従させるのみ）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `server/package.json` の `dependencies` に `@anthropic-ai/claude-agent-sdk` が存在しないこと。
2. `pnpm-lock.yaml` に `@anthropic-ai/claude-agent-sdk` のエントリが残っていないこと。
3. `grep -rn "claude-agent-sdk" server/src mcp/src` が 0 件であること。
4. `pnpm turbo run build` が成功すること。
5. `pnpm turbo run test` が成功すること。
6. `pnpm turbo run lint` が成功すること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

未使用の npm 依存を package.json から取り除き、lockfile を再生成するだけの変更。コード変更・API 変更は発生しない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- `server/package.json`（`dependencies` から 1 行削除）
- `pnpm-lock.yaml`（`pnpm install` による再生成）
- 他ワークスペース（client / common）への影響なし。

## 6. テスト計画（TDDで書くテスト一覧）

本 Issue は「未使用依存の削除」という設定変更であり、新規のドメインロジック・API 挙動の追加は無いため、新規ユニットテストは追加しない。受け入れ条件 3〜6 は既存のリポジトリ検証コマンド（grep / turbo build / test / lint）で直接検証する。TDD の「テストを先に書く」原則は、この Issue では「削除前に検証コマンドを実行し、依存削除後も同じコマンドが green であることを確認する」という形で満たす（削除前後の diff 確認が回帰テストの代わりとなる）。

## 7. リスク・未決事項

- 特になし。`grep` で確認済みの通りコード上の参照が無いため、削除によるビルド破壊のリスクは低い。
