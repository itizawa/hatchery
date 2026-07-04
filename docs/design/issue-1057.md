# 設計書: 既存ワーカーの image_url に残る死んだ source.boringavatars.com URL をクリーンアップする (#1057)

## 1. 目的 / 背景

#1015（PR #1034・develop→main 昇格済み）で、ワーカーのデフォルトアバター解決方式を「外部URL方式（`source.boringavatars.com`）」から「`imageUrl` 未設定なら `null` を返し、client 側で `boring-avatars` パッケージにより描画する」方式に変更した。`resolveWorkerImageUrl({ imageUrl })` は `imageUrl` が設定されていればそれをそのまま返す設計（#1015 受け入れ条件2）のため、**移行前に DB へ保存された `https://source.boringavatars.com/beam/40/{id}` という死んだ URL** は、コード修正後もそのまま返り続け、恒久的に壊れた画像として表示される。

実際に本番 API（`GET /api/communities/hatchery/feed`）で `image_url: "https://source.boringavatars.com/beam/40/da560697-..."` を持つワーカーの存在を確認済み。当該ドメインは 2024-10-19 に SSL 証明書が失効しデプロイ自体が削除済みで恒久的に死んでいる。

## 2. スコープ（やること / やらないこと）

**やること**:
- `common`: 死んだ boringavatars URL かどうかを判定する純粋関数 `isDeadBoringAvatarsWorkerImageUrl` を追加（ユニットテスト可能・DB 不要）。
- `server`: ワンショットの管理スクリプト `server/src/scripts/cleanupDeadWorkerAvatarUrls.ts` を追加し、`Worker.imageUrl` が死んだ boringavatars URL のレコードのみ `null` に更新する。
- `server`: 上記スクリプトのコアロジック（DB 接続をモック可能にした関数）の単体テストを追加し、「対象パターンのみ更新され、admin がアップロードした正規の画像URL（GCS 等）は変更されない」ことを検証する。
- `server/package.json` に実行用 script（`cleanup:worker-avatars`）を追加する。
- PR 本文に stg/本番での実行手順を明記する（実行自体は本 PR のマージ後、運用者が別途行う）。
- 既存の回帰テスト（`workerRepository.test.ts` / `prismaWorkerRepository.test.ts` の「`create()` は常に `imageUrl: null`」検証）が、今後のリグレッション防止（AC4）を既に満たしていることを確認し設計書に明記する（新規テスト追加は不要と判断）。

**やらないこと**:
- コミュニティの `iconUrl`（`common/src/domain/community/community.ts` の `BORING_AVATARS_COMMUNITY_BASE_URL`）は #1057 のスコープ外。これは `bauhaus` スタイルの**現役のフォールバック機能**（#960 で導入）であり、ワーカー側の廃止済み `beam` スタイル URL とは別物。触らない。
- 本 PR 内での stg/本番への実スクリプト実行（DB への実書き込み）は行わない。この Dark Factory ワークフローの実行環境には本番 DB への接続経路がないため、実行は人間 or デプロイ後の運用手順に委ねる。
- `imageUrl` 以外のフィールド（community の `coverUrl`/`iconUrl` 等）の横断調査（Issue 本文で明示的にスコープ外）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `isDeadBoringAvatarsWorkerImageUrl("https://source.boringavatars.com/beam/40/xxx")` が `true` を返す。
2. `isDeadBoringAvatarsWorkerImageUrl("https://storage.googleapis.com/bucket/xxx.png")`（admin アップロードの正規 GCS URL 想定）が `false` を返す。
3. `isDeadBoringAvatarsWorkerImageUrl(null)` / `isDeadBoringAvatarsWorkerImageUrl(undefined)` が `false` を返す。
4. `runCleanupDeadWorkerAvatarUrls(client)` は、死んだ URL を持つ worker の id のみを更新対象として抽出し、`clearImageUrl` に渡す。
5. `runCleanupDeadWorkerAvatarUrls(client)` は、正規の GCS URL を持つ worker や `imageUrl: null` の worker を更新対象に含めない。
6. `runCleanupDeadWorkerAvatarUrls(client)` は対象が 0 件のとき `clearImageUrl` を呼ばず `{ updatedCount: 0, updatedIds: [] }` を返す。
7. `runCleanupDeadWorkerAvatarUrls(client)` は更新件数と対象 id 一覧を返す。
8. スクリプトは `tsx src/scripts/cleanupDeadWorkerAvatarUrls.ts` で直接実行した場合のみ `main()` が走る（`generateReleaseNotes.ts` と同じ `isDirectRun` パターン）。
9. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **common 側の純粋関数**（`common/src/domain/worker/worker.ts`）:
  ```ts
  export const DEAD_BORING_AVATARS_WORKER_URL_PREFIX = "https://source.boringavatars.com/";

  export function isDeadBoringAvatarsWorkerImageUrl(imageUrl: string | null | undefined): boolean {
    return typeof imageUrl === "string" && imageUrl.startsWith(DEAD_BORING_AVATARS_WORKER_URL_PREFIX);
  }
  ```
  DB 接続なしでテストできる判定ロジックをここに切り出し、`server` 側スクリプトはこれを呼ぶだけにする（ロジックの二重実装を避ける）。

- **server 側スクリプト**（`server/src/scripts/cleanupDeadWorkerAvatarUrls.ts`）は `generateReleaseNotes.ts` と同じ構成パターンを踏襲する:
  - DB アクセスを狭いインターフェース `WorkerAvatarCleanupClient`（`findWorkersWithImageUrl` / `clearImageUrl`）に抽象化し、コアロジック `runCleanupDeadWorkerAvatarUrls(client)` をテスト時にモック注入可能にする。
  - 本番経路では `createPrismaWorkerAvatarCleanupClient(prisma)` が実装を提供する（`prisma.worker.findMany({ where: { imageUrl: { not: null } } })` → JS 側で `isDeadBoringAvatarsWorkerImageUrl` によるフィルタ → `prisma.worker.updateMany({ where: { id: { in: targetIds } }, data: { imageUrl: null } })`）。
  - フィルタ判定を DB のクエリ演算子（`startsWith`）ではなく common の純粋関数で行うことで、判定ロジックの正本を 1 箇所（common）に保つ。
  - CLI エントリポイントは `isDirectRun` ガードで、テストからの import 時には実行されない。

- **package.json**: `server/package.json` の `scripts` に `"cleanup:worker-avatars": "tsx src/scripts/cleanupDeadWorkerAvatarUrls.ts"` を追加。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- `common`: `common/src/domain/worker/worker.ts` に関数追加のみ（既存 API 非破壊）。
- `server`: 新規ファイル追加のみ（既存ルーティング・バッチに影響なし）。`package.json` に script 追加。
- `client`: 変更なし（`resolveWorkerImageUrl` の挙動自体は #1015 で確定済みで、DB クリーンアップ後は自然に `boring-avatars` 描画に切り替わる）。
- `docs`: 本設計書のみ。

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/worker/worker.test.ts` に `isDeadBoringAvatarsWorkerImageUrl` のテストケースを追加（AC1〜3）。
2. `server/src/scripts/cleanupDeadWorkerAvatarUrls.test.ts` を新設し、フェイクの `WorkerAvatarCleanupClient`（配列ベースの in-memory 実装）を使って `runCleanupDeadWorkerAvatarUrls` をテストする（AC4〜7）。
3. 既存の `workerRepository.test.ts:16`（`create()` は imageUrl:null を返す）・`prismaWorkerRepository.test.ts:25`（同様）が AC4（今後のリグレッション防止）を既に満たしていることを確認する（新規テスト追加なし、設計書に明記）。

## 7. リスク・未決事項

- 本番 DB への実行は本 PR の範囲外。PR 本文に `pnpm --filter @hatchery/server cleanup:worker-avatars`（要 `DATABASE_URL` 環境変数）という実行手順を明記し、運用者が develop → main 昇格後に stg/本番で実行する想定とする。
- 対象件数が多い場合の性能は考慮していない（workers テーブルは想定規模が小さいため `updateMany` 一括更新で十分と判断）。
