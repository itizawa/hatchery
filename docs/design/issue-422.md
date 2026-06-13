# 設計書: prismaCommunityRepository・prismaPostRepository・prismaCommentRepository の実DB（Docker Postgres）結合テストを追加する (#422)

## 1. 目的 / 背景

`server/src/persistence/` にある Prisma 実装リポジトリのうち、`prismaCommunityRepository`・`prismaPostRepository`・`prismaCommentRepository` に対する実 DB 結合テストが存在しない。インメモリ実装のテスト（`communityRepository.test.ts` 等）は存在するが、実際の SQL・スキーマ制約（ユニーク制約・CASCADE 削除・カーソルページネーション等）は未検証。

本 Issue はこれら 3 リポジトリの Prisma 実装を実 DB（Docker Postgres）で検証し、スキーマ変更・クエリ修正のリグレッションを検知できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**:
- `prismaCommunityRepository.test.ts` — 実 DB で CRUD・findById/findBySlug・list(昇順)・create・update を検証
- `prismaPostRepository.test.ts` — 実 DB で createMany(upsert/二重発火ガード)・listByCommunity・findById・addScore・listLatest・listLatestPaged（境界値）を検証
- `prismaCommentRepository.test.ts` — 実 DB で createMany(upsert)・listByPost・listByCommunity・findById・addScore を検証
- DB 不在環境（`DATABASE_URL` 未設定）では `describe.skipIf` でスキップ

**やらないこと**:
- プロダクションコードの変更
- subscription / vote / worker リポジトリのテスト（別 Issue #423・#424）
- CI への Docker Postgres 組み込み（別途検討）

## 3. 受け入れ条件（テストに落とせる粒度）

### prismaCommunityRepository
1. `findById` — 存在する id: CommunityRecord を返す / 存在しない id: null を返す
2. `findBySlug` — 存在する slug: CommunityRecord を返す / 存在しない slug: null を返す
3. `list` — 空: [] / 複数件: `createdAt` 昇順で返す
4. `create` — slug/name/description から CommunityRecord を作成し返す（id・createdAt が付与される）
5. `update` — name/description を部分更新して返す / 存在しない id: null を返す

### prismaPostRepository
6. `createMany` — 複数 post を作成し返す / `(communityId, slotKey, seq)` 重複は upsert（既存を返す・重複しない）
7. `listByCommunity` — community でフィルタ・createdAt 降順 / 別 community を含めない / limit が効く
8. `findById` — ヒット/ミス
9. `addScore` — score が加算される / 存在しない id: null を返す
10. `listLatest` — 全 community の post を createdAt 降順 / limit
11. `listLatestPaged` — cursor なし（先頭ページ）/ cursor あり（継続ページ）/ limit ちょうど・超過・空

### prismaCommentRepository
12. `createMany` — 複数 comment を作成し返す / `(communityId, slotKey, seq)` 重複は upsert
13. `listByPost` — post でフィルタ・createdAt 昇順 / 別 post を含めない
14. `listByCommunity` — community でフィルタ・createdAt 昇順 / limit
15. `findById` — ヒット/ミス
16. `addScore` — score が加算される / 存在しない id: null を返す

## 4. 設計方針

### テストスキップ方針
```typescript
const DATABASE_URL = process.env.DATABASE_URL;
describe.skipIf(!DATABASE_URL)("createPrismaCommunityRepository (integration)", () => { ... });
```
`DATABASE_URL` が未設定の場合（CI・DB 不在環境）はスキップ。

### PrismaClient の管理
- `beforeAll` で `new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })` を接続
- `afterAll` で `$disconnect()`
- `afterEach` でテストデータを削除（CASCADE 順: Comment → Post → Community）
  - `prisma.community.deleteMany()` → Post・Comment は CASCADE 削除される

### テストデータ管理
- 各テストケース内または `beforeEach` でデータを作成
- `afterEach` でクリーンアップ（テスト間の独立性を保証）

### ページネーションテスト（listLatestPaged）
- `limit=2` で 3 件のpost を作成 → nextCursor が非 null
- cursor を使って 2 ページ目を取得 → 残り 1 件 / nextCursor が null
- 件数 = limit ちょうど → nextCursor が null（`limit+1` の take で判定しているため）

## 5. 影響範囲 / 既存への変更

- 追加: `server/src/persistence/prismaCommunityRepository.test.ts`
- 追加: `server/src/persistence/prismaPostRepository.test.ts`
- 追加: `server/src/persistence/prismaCommentRepository.test.ts`
- プロダクションコード変更: **なし**

## 6. テスト計画（TDD で書くテスト一覧）

| ファイル | テスト名 | 受け入れ条件# |
|----------|----------|:--:|
| prismaCommunityRepository | findById ヒット | 1 |
| prismaCommunityRepository | findById ミス | 1 |
| prismaCommunityRepository | findBySlug ヒット | 2 |
| prismaCommunityRepository | findBySlug ミス | 2 |
| prismaCommunityRepository | list 空 | 3 |
| prismaCommunityRepository | list 複数件・昇順 | 3 |
| prismaCommunityRepository | create | 4 |
| prismaCommunityRepository | update 更新 | 5 |
| prismaCommunityRepository | update 不存在 | 5 |
| prismaPostRepository | createMany 複数作成 | 6 |
| prismaPostRepository | createMany 重複 upsert | 6 |
| prismaPostRepository | listByCommunity フィルタ | 7 |
| prismaPostRepository | listByCommunity limit | 7 |
| prismaPostRepository | findById ヒット/ミス | 8 |
| prismaPostRepository | addScore 加算 | 9 |
| prismaPostRepository | addScore 不存在 | 9 |
| prismaPostRepository | listLatest 全件・降順 | 10 |
| prismaPostRepository | listLatestPaged 先頭ページ | 11 |
| prismaPostRepository | listLatestPaged 継続ページ | 11 |
| prismaPostRepository | listLatestPaged 空 | 11 |
| prismaCommentRepository | createMany 複数作成 | 12 |
| prismaCommentRepository | createMany 重複 upsert | 12 |
| prismaCommentRepository | listByPost フィルタ・昇順 | 13 |
| prismaCommentRepository | listByCommunity フィルタ | 14 |
| prismaCommentRepository | findById ヒット/ミス | 15 |
| prismaCommentRepository | addScore 加算/不存在 | 16 |

## 7. リスク・未決事項

- Docker Postgres が利用できない環境では全テストがスキップされる（これは意図した挙動）
- テスト実行前に `prisma migrate deploy` 済みの DB が必要（`DATABASE_URL` を設定して実行する前提）
- `listLatestPaged` の cursor テストは `createdAt` に依存するため、同一ミリ秒での挿入を避けるため適切に時刻差を設けるか、件数ベースでの検証に限定する
