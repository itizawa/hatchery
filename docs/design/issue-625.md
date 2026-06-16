# 設計書: Issue #625 — ワーカーごとに文章量（簡潔/標準/詳細）を設定し生成プロンプトに反映する

## 背景・目的

ワーカーごとに「文章量」の傾向（簡潔 / 標準 / 詳細）を設定でき、その設定が定時バッチの生成プロンプトに反映されて、投稿・コメントの分量を出し分けられる状態にする。

`personality`（#38）と同じ経路（common Zod → prisma → repository → 生成プロンプト → admin API → client 編集フォーム）に「文章量」設定を追加する。

## 実装方針

### 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `common/src/domain/worker/worker.ts` | `WorkerVerbositySchema` 定義、`WorkerSchema` / `UpdateWorkerSchema` / `CreateWorkerSchema` に `verbosity` 追加 |
| `common/src/domain/worker/worker.test.ts` | `verbosity` に関するテスト追加 |
| `server/prisma/schema.prisma` | `model Worker` に `verbosity` カラム追加（デフォルト `"standard"`） |
| `server/prisma/migrations/` | マイグレーション追加 |
| `server/src/persistence/workerRepository.ts` | `WorkerRecord` / `CreateWorkerInput` に `verbosity` 追加、in-memory 実装更新 |
| `server/src/persistence/workerRepository.test.ts` | `verbosity` round-trip テスト追加 |
| `server/src/persistence/prismaWorkerRepository.ts` | `verbosity` 読み書き対応 |
| `server/src/batch/buildCommunityPrompt.ts` | `WorkerDef` に `verbosity` 追加、プロンプト生成に分量指示注入 |
| `server/src/batch/buildCommunityPrompt.test.ts` | `verbosity` 3 値の分量指示テスト追加 |
| `server/src/routes/admin.ts` | `verbosity` を受け取り・返却 |
| `server/src/openapi/registrations/registerWorkers.ts` | `WorkerSchema` の `verbosity` フィールドを反映（WorkerSchema 自動更新） |
| `client/src/components/EditWorkerDialog.tsx` | 文章量の Select UI を追加 |
| `client/src/components/EditWorkerDialog.test.tsx` | RTL テストで verbosity 選択・送信テスト追加 |
| `client/src/api/workers.ts` | `useUpdateWorker` の body 型に `verbosity` 追加 |
| `e2e/admin/usecases.md` | UC-ADMIN-15 追加 |

### 設計判断

1. **WorkerVerbosity は enum 3 段階**: `concise` / `standard` / `detailed`。string ではなく enum にすることでプロンプト制御とテストを明確化。`.max()` は enum なので不要。

2. **デフォルトは `standard`**: 未指定時は `standard` として扱う。既存ワーカーが壊れない。Prisma スキーマの `@default("standard")` で DB 側デフォルトを設定。

3. **プロンプト注入**: `concise` の場合のみ分量制限指示を注入し、`standard` は特別な指示なし（既定の分量）、`detailed` は詳細指示を注入。

4. **enum → 日本語プロンプト指示のマッピング**:
   - `concise`: `「1〜2 文程度で簡潔に。要点のみ。」`
   - `standard`: 特別な指示なし（既定の分量）
   - `detailed`: `「具体例や背景を交えてやや詳しめに（ただし冗長になりすぎない）。」`

5. **WorkerRecord に verbosity を追加**: `verbosity: string` として DB から読み込んだ値をそのまま格納。型安全性は API 境界の Zod バリデーションで担保する。

6. **OpenAPI 一方向フロー遵守**: common Zod スキーマ → server openapi.json 生成 → client 型生成の流れを維持。

## 受け入れ条件の整理

1. `WorkerVerbositySchema = z.enum(["concise","standard","detailed"])` を定義し、3 値を受理し未知値を弾くことをユニットテストで検証する。
2. `server/prisma/schema.prisma` の `model Worker` に `verbosity` カラム（既定 `standard`）を追加し、マイグレーションを作成する。
3. リポジトリが `verbosity` を読み込み・更新できる（round-trip）。
4. `buildCommunityPrompt` が各ワーカーの `verbosity` を日本語の分量指示としてプロンプトに埋め込む。
5. admin の worker 取得・更新 API が `verbosity` を返却・更新できる。
6. `EditWorkerDialog` で文章量を Select UI で編集できる。`@tanstack/react-form` を使用。
7. `pnpm turbo run build|test|lint` が緑。

## 考慮事項

- **既存ワーカーの後方互換**: `verbosity` を optional にし、DB デフォルトを `standard` に設定。既存データは `standard` で扱われる。
- **マイグレーション衝突**: 最新の develop を取り込んでから生成する。
- **スコープ外**: コメント単位・コミュニティ単位での文章量制御、動的調整は対象外。
