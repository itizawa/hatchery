# 設計書: pnpm db:seed が現行スキーマに無い Worker.isBot/userId を参照して失敗するのを修正する (#456)

## 1. 目的 / 背景

`pnpm --filter @hatchery/server db:seed` を実行すると Prisma が `Unknown argument 'isBot'` を投げて失敗するという問題。

原因: `server/prisma/seedDevData.ts` の `worker.upsert` が、`#329`（Employee→Worker リネーム）・`#331`（isBot/userId 廃止）で削除されたフィールド (`isBot`, `userId`) を参照していた。
現行 `schema.prisma` の `Worker` モデルには `id / displayName / role / personality / deletedAt / imageUrl` しか存在しない。

## 2. スコープ（やること / やらないこと）

**やること**:
- `seedDevData.ts` の `SeedPrisma` 型と `worker.upsert` 引数を現行 `Worker` スキーマに追従させる
- `seedDevData.test.ts` の fake prisma・アサーションを更新後の挙動に合わせる
- `seed.ts` の完了ログ文言（旧表記 "testpass・社員・チャンネル"）を現行に更新する

**やらないこと**:
- `Worker` スキーマへの `isBot`/`userId` 復活（現行スキーマを正とする）
- Post/Comment サンプルデータ投入
- WorkerCommunity の seed（スコープ外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `seedDevData.ts` の `SeedPrisma.worker.upsert.create` 型が現行 `Worker` スキーマ（`id / displayName / role / personality / deletedAt / imageUrl`）の必須フィールドのみ含み、`isBot`/`userId` を含まない
2. `seedDevData.ts` の worker upsert 呼び出しが `id / displayName / role` のみを渡す（`isBot`/`userId` を含まない）
3. `seedDevData.test.ts` の fake prisma が `isBot`/`userId` フィールドを記録せず、テストが通る
4. `NODE_ENV=production` でスキップする挙動が引き続きテストで担保される
5. `pnpm turbo run test` がすべて緑
6. `pnpm turbo run lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`#331`（ADR-0020後処理）で `Worker` モデルから `isBot`/`userId`/`user` が削除されたが、seed ファイルへの追従が漏れていた。

修正方針:
- `SeedPrisma` インターフェースの `worker.upsert.create` から `isBot`/`userId` を削除（すでに `#455` 対応時に修正済みであることを確認）
- `DEFAULT_WORKERS` 定義から `isBot`/`userId` を削除（すでに修正済み）
- `seed.ts` のログ文言を "testuser・既定のワーカー・コミュニティ" に更新（未修正）

調査の結果、`develop` ブランチの `seedDevData.ts` は `#455`（Google-only 認証対応）の際に `isBot`/`userId` がすでに削除されており、コアバグは修正済み。
残件は `seed.ts` の完了ログ文言（"testpass", "社員", "チャンネル" という旧用語）の更新のみ。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

- `server/prisma/seed.ts`: 完了ログの文言修正（"社員・チャンネル" → "ワーカー・コミュニティ"）
- `server/prisma/seedDevData.ts`: 修正不要（develop で修正済み）
- `server/prisma/seedDevData.test.ts`: 修正不要（develop で修正済み）

## 6. テスト計画（TDDで書くテスト一覧）

既存テスト（`server/prisma/seedDevData.test.ts`）がすでに以下を担保:
- dev ユーザーを `email / googleId` で `user.upsert` する
- AI ワーカー 3 名を `worker.upsert` で投入する（`isBot`/`userId` なし）
- コミュニティ 3 件（technology / daily / hatchery）を `community.upsert` で投入する
- `NODE_ENV=production` ではスキップする

seed.ts のログ文言変更はロジック変更なく既存テストの対象外。テスト追加は不要。

## 7. リスク・未決事項

- 実 DB への `db:seed` 成否はローカル DB なしでは検証不可。ただし Prisma クライアント型と `schema.prisma` の整合は `prisma generate` → TypeScript コンパイルで担保される。
- `WorkerCommunity` の seed は未実装のまま（スコープ外）。定時バッチはワーカーとコミュニティの紐づけを管理画面から手動設定する前提。
