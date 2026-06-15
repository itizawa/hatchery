# 設計書: Issue #539 — 未使用の静的発言テンプレート workerMessages.ts を削除

## 背景・目的

`common/src/constants/workerMessages.ts`（`WORKER_MESSAGE_TEMPLATES` / `getWorkerMessageTemplates` と
Employee 系 deprecated alias）は #32 当時の MVP「静的発言テンプレート」用モジュール。会話生成は
Claude 単発コール（ADR-0023）へ完全移行済みで、本番コード（server/src・client/src）からの参照は 0。
`common/src/index.ts` の barrel と自身の test、リポジトリ規約テストの存在アサーションのみが利用箇所の
死蔵モジュールであり、削除して common を実使用ロジックだけに保つ。

## 受け入れ条件

1. `common/src/constants/workerMessages.ts` と `workerMessages.test.ts` を削除する。
2. `common/src/index.ts` の `export * from "./constants/workerMessages.js";` を除去する。
3. server/client からの参照切れが無いこと（`pnpm turbo run build typecheck` 緑）。
4. `pnpm turbo run build test lint` が緑。

## 設計判断の要点

- **純粋な削除**。新たなロジック追加はない。
- **リポジトリ規約テストの更新**: `tests/worker-naming.test.ts` は #329（Employee→Worker リネーム）の
  規約テストで、`workerMessages.ts が存在する` を assert していた。本 Issue でこのファイルを意図的に
  削除するため、当該テストを「`workerMessages.ts`（旧 Employee 系含む）が削除済みであること」を
  assert する形に更新する。これは「ファイルの存在/非存在という観察対象そのものが仕様変更で反転する」
  ケースであり、TDD の「実装中はテストを変更しない」原則に反しない（先にテストを反転させて失敗 →
  削除実装で緑、の順を踏む）。
- `common/src/constants/` 配下に他ファイルが無くなる場合、空ディレクトリは git 管理外となり自然消滅する
  （明示削除は不要）。
- **スコープ外**: 会話生成プロンプト（`server/src/batch/buildCommunityPrompt.ts`）には一切触れない。

## ユーザー可視の振る舞い

変化なし（純粋な未使用コード削除）。よって `e2e/` ユースケースの更新は不要。

## 関連

#32, #329, ADR-0023, ADR-0005
