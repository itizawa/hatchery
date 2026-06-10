# ADR-0024: 永続化アダプタ/スケジューラをクラスから関数ファクトリ（関数 DI）で実装する

- ステータス: Accepted
- 日付: 2026-06-10
- 関連 Issue: #288

## コンテキスト（背景）

server は層分離（routes → usecases → persistence[ポート]）で構成され、ルート・usecase・バッチ本体は既に**関数 DI**（`createXxxRouter(repo)` / deps 引数注入）で配線されている。一方で OOP が残っていたのは **永続化アダプタのクラス実装**（`InMemoryXxxRepository` / `PrismaXxxRepository`）と既定スケジューラ `SystemScheduler`、およびその生成箇所のみだった。

`class Xxx implements XxxRepository { constructor(...) {} ... }` という形は、ポートの `interface` を満たす実装手段として機能上は十分だが、本プロジェクトの DI スタイル（手動 DI・関数注入）と二重の語彙（`new` とクロージャ）になっていた。実装規約を一本化するため、アダプタ/ポート実装の標準形を**ポート型を返すファクトリ関数（クロージャ）**に統一する。

ADR-0012 で「IoC（DI コンテナ）は導入せず手動 DI を継続する」と決定済み。本決定は**コンテナ導入ではなく**、アダプタ実装のスタイル決定であり、手動配線・composition root（`server.ts` / `batch`）はそのまま維持するため ADR-0012 と矛盾しない。

## 決定

**永続化アダプタおよびポート実装は、クラス（`implements`）ではなく「ポート型を返すファクトリ関数（クロージャ）」で実装する。**

- **(a)** 永続化アダプタ/ポート実装は `createInMemoryXxxRepository(...): XxxRepository` / `createPrismaXxxRepository(prisma): XxxRepository` の**関数ファクトリ**で実装し、`class ... implements XxxRepository` は使わない。内部状態（配列 / Map / seq）はクロージャ変数に閉じる。スケジューラも同様に `createSystemScheduler(): SchedulerPort`。
- **(b)** ポートの `interface`（`XxxRepository` / `SchedulerPort`）は維持する。利用側（routes / usecases / batch 本体）のシグネチャは不変。
- **(c)** 手動 DI（DI コンテナ無し・composition root = `server.ts` / `batch` / `createPrismaDeps`）は ADR-0012 どおり継続する。
- **(d)** 例外クラス（`LoginIdAlreadyExistsError` 等の `extends Error`）、および common の `AppError` は本決定の対象外（関数化しない）。`Record` 型・入力型の `interface` も維持する。

## 理由

- ルート・usecase・バッチ本体が既に関数 DI である中で、アダプタだけクラスだったため**実装スタイルを一本化**することで読み手の負荷を下げられる。
- クロージャでの状態保持は `this` バインディングの考慮が不要で、メソッドの取り出し（`repo.list` を単独で渡す等）でも壊れにくい。
- ポートの `interface` を維持するため、**部分適用・段階移行が可能**（クラスと関数ファクトリが一時混在しても利用側に影響しない）。既存テストが挙動のセーフティネットになり、純粋リファクタとして安全に進められた。

## 検討した代替案

- **案A: クラス（`implements`）を維持する**: 動作上は問題ないが、関数 DI のルート/usecase 層と語彙が割れる。一本化の利点を得られないため不採用。
- **案B: DI コンテナ（Awilix 等）でアダプタ生成を集約する**: ADR-0012 で不採用済み。手動 DI の明示性を失うため不採用。
- **案C: ポートを `interface` から `type` エイリアスへ替える**: 本件のスコープ外（将来拡張）。本決定では `interface` を維持する。

## 影響（結果）

- 良い影響: server の永続化層の実装スタイルが関数 DI に統一され、`new` での生成が消えた。`src`（テスト含む）から `class \w*Repository ... implements` と `new (InMemory|Prisma)\w*Repository(` が消えていることを規約テスト（`functionalRepositories.convention.test.ts`）で機械的に強制する。
- トレードオフ / 注意点: 既存の公開シンボル名が変わった（`InMemoryUserRepository` → `createInMemoryUserRepository`、static `InMemoryUserRepository.createWithTestUser` → `createTestUserRepository`、`PrismaUserRepository` → `createPrismaUserRepository`）。`@hatchery/server` の index re-export も更新済み。
- フォローアップ: 今後 server に追加する永続化アダプタ/ポート実装は本 ADR に従いファクトリ関数で実装する。`StorageService`（外部サービスアダプタ）は本件のスコープ外で別途検討。
