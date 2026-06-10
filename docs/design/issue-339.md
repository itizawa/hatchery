# 設計書: WorkerState から mood / experience / relations / hasEvolved を削除する（ADR-0023 後処理） (#339)

## 1. 目的 / 背景

ADR-0023 で成長・ペイオフ構想（進化イベント・経験値・関係値・mood）を concept から削除する決定をした。concept.md は改訂済みだが、Phase 1 の基盤として先行実装されていた `WorkerState` の成長系フィールド（`mood` / `experience` / `relations` / `hasEvolved`）と `WorkerRelationSchema` がコードに残っている。これらはスキーマ定義とそのテスト以外から参照されていない（バッチ・API・永続化実装は未使用）。本 Issue でこれらを取り除き、ADR-0023 の「成長メカニクスを持たない」決定とコードを一致させる。

## 2. スコープ（やること / やらないこと）

### やること
- `common/src/domain/worldState/worldState.ts` から `WorkerRelationSchema` / `WorkerRelation` 型 / `mood` / `experience` / `relations` / `hasEvolved` を削除し、`WorkerStateSchema` を `lastAppearedSlotKey` のみへ縮小する。
- 関連コメント（mood / experience / relations / hasEvolved / WorkerRelation の記述）を削除する。
- `worldState.test.ts` を縮小後スキーマに合わせて更新し、旧フィールドが残った JSON でも strip されてパースが落ちないことをテストで保証する。

### やらないこと
- 登場ローテーション制御そのものの実装・変更（`lastAppearedSlotKey` は現状維持）。
- Prisma スキーマ変更（`worker_states` 相当は JSON カラムのためマイグレーション不要）。
- 永続化実装（`worldStateRepository` / `prismaWorldStateRepository`）のロジック変更（これらは `workerStates` を素通しするため、フィールド削除の影響を受けない）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `WorkerStateSchema` が `lastAppearedSlotKey` のみを持ち、`mood` / `experience` / `relations` / `hasEvolved` と `WorkerRelationSchema` が削除されている。
2. `mood` / `experience` / `hasEvolved` / `WorkerRelation` が common/src・server/src（*.ts、コメント含む）に grep でヒットしない。
3. 旧フィールド（mood / experience / relations / hasEvolved）が残った workerState JSON でも、Zod が strip して `safeParse` が success になり、結果に旧フィールドが含まれない。
4. `lastAppearedSlotKey` を持つ workerState を正しくパースできる。空 workerStates / デフォルト（空オブジェクト）も従来どおりパースできる。
5. `pnpm turbo run build test lint` がすべて緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `WorkerStateSchema = z.object({ lastAppearedSlotKey: z.string().optional() })` へ縮小。`z.object` は既定で未知キーを strip するため、既存 DB の旧フィールドはパース時に黙って落ち、マイグレーション不要。
- `WorldStateSchema` / `WorldState` 型・`workerStates` レコード構造は不変。
- 永続化層（ポート / Prisma 実装）は `workerStates` を JSON として素通しするだけなので変更不要。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- common: `worldState.ts`（スキーマ縮小）・`worldState.test.ts`（更新）。
- server: 変更なし（repository は素通し。grep ヒットも無い）。
- client: 変更なし（当該フィールド未使用）。
- docs: 本設計書を追加。

## 6. テスト計画（TDDで書くテスト一覧）

`worldState.test.ts` を以下に更新する:
- `WorkerStateSchema` が `lastAppearedSlotKey` のみを持つ（旧フィールドは strip）。
- 旧フィールド入り JSON を safeParse → success かつ結果に mood / experience / relations / hasEvolved が含まれない。
- `lastAppearedSlotKey` を持つ workerState を正しくパースできる。
- 空 workerStates / デフォルト（`{}`）が従来どおりパースできる。
- open_prompts / synopsis を持たない（既存テスト維持）。

## 7. リスク・未決事項

- リスクは小さい。当該フィールドはコード内で未使用のため、削除による機能影響は無い。
- 既存 DB の `worker_states` JSON に旧フィールドが残っていても Zod strip で吸収されるため、マイグレーションは不要。
