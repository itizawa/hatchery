# Issue #376: workerRepository（インメモリ実装）のユニットテストを追加する

## 背景 / 目的

`server/src/persistence/workerRepository.ts` のインメモリ実装（`createInMemoryWorkerRepository`）は、
他の persistence 層（commentRepository / communityRepository 等）と異なり対応するユニットテストを持たない。
worker は論理削除（`deletedAt`）を持ち、一覧の削除済み除外/包含・更新・検索など分岐が多いにもかかわらず
テストで保証されていないため、DB 非依存で高速にリグレッションを検出できるテストを追加する。

## 方針

- 対象は `createInMemoryWorkerRepository` のみ（`prismaWorkerRepository.ts` はスコープ外）。
- 雛形は `communityRepository.test.ts` / `commentRepository.test.ts` のスタイルに合わせる
  （`makeWorker` ヘルパー + メソッドごとの `describe` ブロック）。
- 更新入力は common の `UpdateWorkerInput`（`UpdateWorkerSchema` 由来）に整合させる。
- 実装コードは変更しない（テスト追加のみで完結。テストは現仕様を表現する）。

## テスト観点（公開 API ごと）

| メソッド | 検証内容 |
|---|---|
| `create` | 入力どおりの WorkerRecord を返す（role/personality 省略時は null、imageUrl/deletedAt は null）。作成後 `findById` で取得できる |
| `findById` | 存在する id で取得できる / 存在しない id は null / 論理削除済みは null |
| `update` | displayName / role / personality が反映される。未指定フィールドは変更されない。存在しない id・削除済みは null |
| `listByIds` | 指定 id 群のみ返す。存在しない id は除外。削除済みは除外。ids の順序を保つ |
| `listBotWorkers` | 全件返す。削除済みは既定で除外 |
| `listAllBotWorkers` | 削除済みを含めて全件返す |
| `softDelete` | `deletedAt` がセットされる。以後 `findById` / `listBotWorkers` から外れる。存在しない id・二重削除は null |
| `findDeletedById` | 削除済みでも id で取得できる。存在しない id は null |
| `updateImageUrl` | imageUrl が反映される。存在しない id は null。削除済みにも反映される（現仕様） |
| 防御的コピー | 返却レコードを書き換えても内部状態に影響しない（現実装は shallow copy を返す） |

## 受け入れ条件との対応

1. `server/src/persistence/workerRepository.test.ts` を新規追加 → 上表のとおり網羅。
2. DB（Prisma）非依存・インメモリ実装のみを対象。`UpdateWorkerInput` 型を common から import。
3. `pnpm turbo run build test lint` 緑。import は `server → common` の一方向のみ（境界遵守）。
