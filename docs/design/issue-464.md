# Issue #464 設計: worldState の登場ローテーション（lastAppearedSlotKey）

## 背景・目的

`worldState`（型 `common/src/domain/worldState/worldState.ts` / Prisma `WorldState` / `worldStateRepository`）は実装済みだがビジネスロジックから一切参照されず、`server/src/app.ts` で `void worldStateRepo;` により未使用警告を握りつぶしているデッドコードになっている。

ADR-0023 で mood / experience / relations / hasEvolved は廃止されたが、**登場ローテーション制御に必要な `lastAppearedSlotKey` のみは維持する**と決定済み（`worldState.ts` のコメント・`concept.md` 定時バッチ⑥）。本 Issue は `worldState.workerStates[workerId].lastAppearedSlotKey` を読み書きして、定時バッチの登場ワーカー選定を「最近登場していないワーカー優先」で公平ローテーションさせ、デッドコードを解消する。

## 現状アーキテクチャ（develop 時点・Issue 本文と差分あり）

- 定時バッチは `server/src/batch/runCommunityBatch.ts`。**1 定時 = vote 重み付きランダムで 1 コミュニティだけ**を選んで生成する（ADR-0030 / #486）。
- 登場ワーカーは `selectCommunityWorkers`（`common/src/domain/worker/`）で `WorkerCommunity` 紐づき → 0 件なら全 Bot にフォールバックして解決し、**解決した全員**を生成プロンプト・author 検証に使う（選出人数による絞り込みは無い）。
- `common/src/logic/selectAppearingMembers.ts` に登場メンバー選定の純粋関数が既にあるが、`lastAppearedSlotKey`（string）ではなく `Record<string, number>`（定時番号）を入力に取り、かつバッチから未使用。本 Issue では `worldState` の `workerStates`（`lastAppearedSlotKey: string` マップ）を直接入力に取る純粋関数を新設する。
- `worldStateRepository` は `AppDeps`（Express）に注入されているが routes から未使用。`runCommunityBatch` の deps には未注入。

## 受け入れ条件への対応方針

### AC1: common に純粋関数を TDD で追加

`common/src/domain/worldState/selectRotatedWorkers.ts` を新設（同層に `*.test.ts`）。

```
selectRotatedWorkers(
  workers: readonly { id: string }[],
  workerStates: Readonly<Record<string, { lastAppearedSlotKey?: string }>>,
  count: number,
): string[]
```

- `lastAppearedSlotKey` が古い（=最近登場していない）ワーカーを優先して最大 `count` 名の id を返す。
- **slotKey は `"YYYY-MM-DDTHH:MM"` 形式（`generateSlotKey`）で辞書順 = 時系列順**。よって文字列の昇順比較で「古い順」を判定できる（新たな日時パースは不要）。
- 未登場（`lastAppearedSlotKey` undefined / エントリ無し）は最優先（空文字より前 = 最古扱い）。
- 同点（同じ slotKey・ともに未登場）は **入力順の安定ソート**で決定的。
- `count <= 0` → 空配列。候補数 ≤ count → 全員（ローテーション順に並べ替えて返す）。候補空 → 空配列。
- 入力（workers / workerStates）は破壊しない。

参照雛形: `common/src/logic/selectAppearingMembers.ts`（既存の登場メンバー選定純粋関数）と同テスト構成。

### AC2: 定時バッチで `lastAppearedSlotKey` を更新（upsert）

`runCommunityBatch`（`server/src/batch/runCommunityBatch.ts`）に:

- `worldStateRepository?: WorldStateRepository` を deps に追加（注入されたときのみローテーション・更新を行う。既存テストとの後方互換のため optional）。
- `appearingWorkerCount?: number` を deps に追加（登場させる最大人数。**省略時は解決した全ワーカー**を対象 = 既存挙動を維持）。
- 登場メンバー選定時に、worldStateRepository があれば現在の `workerStates` を読み、`selectRotatedWorkers(resolvedWorkers, workerStates, count)` で **最近登場していないワーカー優先**に並べ替え・絞り込む。
- 生成・永続化が**成功した**定時について、登場した（= プロンプト・検証に使った）ワーカー全員の `workerStates[workerId].lastAppearedSlotKey = slotKey` を `worldStateRepository.upsert` で保存する。`summaryVersion` は既存値を維持。
- 二重発火（同一 slotKey で既に post 済み）でスキップした場合・生成失敗でスキップした場合は更新しない。

バッチ CLI（`server/src/batch/communityBatchIndex.ts`）の本番 deps に `createPrismaWorldStateRepository(prisma)` を配線する。

### AC3: `app.ts` の `void worldStateRepo;` を撤去

`server/src/app.ts` の `const worldStateRepo = deps.worldStateRepository;` と `void worldStateRepo;` を削除する。`worldStateRepository` は **バッチで実際に利用される経路**（`runCommunityBatch` → `worldStateRepository.upsert`）に接続される。`AppDeps.worldStateRepository` フィールド自体は `createPrismaDeps` の生成対象として残すが、未参照ローカル変数が消えるため未使用抑止の `void` は不要になる。

### AC4: 依存方向・規約

- 純粋関数は `common`（server→common 一方向 import 維持）。永続化・ユースケースは `server`。
- 新しいユーザー入力文字列フィールドは増やさない（`lastAppearedSlotKey` はシステム生成の slotKey）。

### AC5: build / test / lint 緑

`pnpm typecheck` / `pnpm lint` / 関連 `pnpm --filter test` を緑にする。

## ユーザー可視挙動

「最近登場していないワーカーが優先的に登場しやすくなる」という確率的な内部挙動の変化であり、画面・遷移・操作結果・空状態/エラー表示といった**観察可能な振る舞いの追加・変更ではない**（登場ワーカーが DB のワーカー集合から選ばれて投稿される点は不変）。よって `e2e/` ユースケースの更新は不要（純バックエンドのローテーション制御）。

## スコープ外

mood / 関係値等を使った重み付けの高度化（ADR-0023 で廃止）、`summaryVersion` の活用は対象外。`lastAppearedSlotKey` の新旧のみの単純ローテーションに留める。
