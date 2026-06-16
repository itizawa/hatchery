# 設計書: worker の personality / avatarUrl 文字数上限をマジックリテラルから名前付き定数に統一する (#592)

## 1. 目的 / 背景

`common/src/domain/worker/worker.ts` で `personality` の上限が `.max(500)` リテラルで 3 箇所（WorkerSchema / UpdateWorkerSchema / CreateWorkerSchema）に重複している。さらに `client/src/components/EditWorkerDialog.tsx` がローカルで `PERSONALITY_MAX_LENGTH = 500` を再定義しており、common の Zod 上限とフロント `maxLength` が無言で乖離するリスクがある（CLAUDE.md「同じ上限をサーバ Zod と二重で守る」に反する）。

`avatarUrl` フィールドは #541 で削除済みだが、`WORKER_AVATAR_URL_MAX_LENGTH` 定数は将来の再利用性・ドキュメント目的で `2048` として export する（Issue の受け入れ条件に明示されている）。

## 2. スコープ（やること / やらないこと）

**やること:**
- `WORKER_PERSONALITY_MAX_LENGTH = 500` を `common/src/domain/worker/worker.ts` に追加・export
- `WORKER_AVATAR_URL_MAX_LENGTH = 2048` を同ファイルに追加・export
- `worker.ts` 内の `.max(500)` リテラル 3 箇所を `WORKER_PERSONALITY_MAX_LENGTH` に置換
- `EditWorkerDialog.tsx` のローカル `PERSONALITY_MAX_LENGTH` を削除し `@hatchery/common` から `WORKER_PERSONALITY_MAX_LENGTH` を import して使用

**やらないこと:**
- スキーマ構造・バリデーションロジック自体の変更（純粋リファクタ）
- UI 表示・挙動の変更（ユーザー可視の振る舞いは変わらない）
- 後方互換エクスポートの追加（既存の定数名は変更しない）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `WORKER_PERSONALITY_MAX_LENGTH` が `500` で `common/src/domain/worker/worker.ts` からエクスポートされる
2. `WORKER_AVATAR_URL_MAX_LENGTH` が `2048` で `common/src/domain/worker/worker.ts` からエクスポートされる
3. `grep -n "\.max(500)\|\.max(2048)" common/src/domain/worker/worker.ts` が 0 件
4. `grep -n "const PERSONALITY_MAX_LENGTH" client/src/components/EditWorkerDialog.tsx` が 0 件
5. `EditWorkerDialog.tsx` が `@hatchery/common` から `WORKER_PERSONALITY_MAX_LENGTH` を import している
6. `pnpm turbo run build test lint` がすべて緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 定数の命名規則は既存の `WORKER_DISPLAY_NAME_MAX_LENGTH` / `WORKER_ROLE_MAX_LENGTH` / `WORKER_IMAGE_URL_MAX_LENGTH` に倣う
- `index.ts` は `export * from "./worker.js"` 済みのため追加エクスポート不要
- `EditWorkerDialog.tsx` の import 行を修正するだけ。コンポーネントのロジック・JSX は一切変更しない

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更内容 |
|---|---|---|
| common | `src/domain/worker/worker.ts` | 定数 2 件追加、`.max(500)` リテラル 3 箇所を定数参照に変更 |
| client | `src/components/EditWorkerDialog.tsx` | ローカル定数削除、import 追加・使用箇所置換 |

ユーザー可視の振る舞いは変わらない（純粋リファクタ）。

## 6. テスト計画（TDD で書くテスト一覧）

`common/src/domain/worker/worker.test.ts`:
- `WORKER_PERSONALITY_MAX_LENGTH` が 500 でエクスポートされる（新規・FAIL 先行）
- `WORKER_AVATAR_URL_MAX_LENGTH` が 2048 でエクスポートされる（新規・FAIL 先行）
- personality が `WORKER_PERSONALITY_MAX_LENGTH` 文字ちょうどなら全スキーマで parse 成功（既存テストを定数参照に更新）
- personality が `WORKER_PERSONALITY_MAX_LENGTH + 1` 文字なら全スキーマで parse 失敗（既存テストを定数参照に更新）

`client/src/components/EditWorkerDialog.test.tsx`:
- personality の入力に `maxLength=WORKER_PERSONALITY_MAX_LENGTH` が設定されている（既存テストを定数参照に更新）

## 7. リスク・未決事項

- `WORKER_AVATAR_URL_MAX_LENGTH` は現時点でスキーマ上未使用（`avatarUrl` フィールドは #541 で削除済み）。定数のみ追加して将来の利用に備える。
- 純粋なリファクタのため e2e ユースケース更新は不要（ユーザー可視の振る舞いは変わらない）。
