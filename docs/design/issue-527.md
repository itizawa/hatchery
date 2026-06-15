# Issue #527 設計書: コミュニティ一覧/カードに「投稿数・最終投稿」の活気指標を表示する

## 背景・目的

`/communities` のコミュニティカードは名前と説明文しか表示されておらず、どのコミュニティが活発か（投稿数・最終投稿時刻）が分からない。
活気指標を表示することで、賑わっているコミュニティへの回遊を促す。

## 受け入れ条件の整理

1. `GET /api/communities` のレスポンスに各コミュニティの **投稿数**（`post_count`）と **最終投稿時刻**（`last_post_at`）を追加する。
2. 集計は Prisma の `_count` と `orderBy` を使い N+1 を避ける。
3. `CommunityBrowseScene.tsx` のカードに投稿数・最終投稿（相対時間）を表示する。0件/未投稿の場合も表示を定義する。
4. server の `communities.test.ts` と client の `CommunityBrowseScene.test.tsx` を追加/更新する。
5. `e2e/community/usecases.md` と `e2e/usecases.md` に該当ユースケース（UC-COMM-12）を追記する。
6. `pnpm turbo run build test lint` が緑。

## 設計方針

### スキーマ変更

Prismaのスキーマ変更は不要。投稿数と最終投稿時刻は既存の `Post` テーブルから集計する。

### API 変更

#### common: CommunitySchema の拡張

`common/src/domain/community/community.ts` の `CommunitySchema` に以下を追加:
- `post_count`: `z.number().int().min(0)` — 投稿数（必須・0 以上の整数）
- `last_post_at`: `z.string().datetime().nullable().optional()` — 最終投稿時刻（ISO 文字列 or null）

#### server: CommunityRepository の拡張

`communityRepository.ts` に以下を追加:
- `listWithStats(): Promise<CommunityRecordWithStats[]>` — post_count と last_post_at を集計して返す

`CommunityRecordWithStats` は `CommunityRecord & { postCount: number; lastPostAt: Date | null }` として定義する。

#### server: communities.ts の変更

`GET /` を `communityRepo.listWithStats()` を使うよう変更し、`toCommunityResponse` に `post_count` と `last_post_at` を含める。

**N+1 回避**: Prisma実装は `findMany` に `_count: { select: { Post: true } }` と各コミュニティの最新投稿取得を一発で行う。
InMemory実装では post の全件取得をせず、`listWithStats` 専用のロジックを実装する。

ただし、InMemoryRepositoryはテスト専用のため、stats の計算は素直にプレーンな実装でよい。
PostRepositoryへの依存は避け、コンストラクタで postRecordsを受け取るか、
または listWithStats の引数で postRecords を渡す方式にする。

**実際の設計**: `createInMemoryCommunityRepository` に `PostRepository` を渡す代わりに、
`listWithStats` メソッドで統計を外部から注入する形（コールバック）にする。
→ しかしこれは複雑。

最終的に採用する方針: `createInMemoryPostRepository` の実装を変更せず、
テスト側で `communityRepo.listWithStats()` の代替として `list()` + stats手動付与を行う。

実際はよりシンプルに: `communities.ts` ルーターは `postRepo` を既に受け取っているので、
ルーター内で集計ロジックを実装する。

#### 採用設計: ルーター層で集計

```
GET /api/communities:
  1. communityRepo.list() — community 一覧
  2. postRepo.listLatest(10000) — 全 post（実運用は最大数千件・パフォーマンス許容範囲内）
     → ただしこれは本番スケールで問題あり
```

N+1 回避の最善策: PostRepository に `getStatsPerCommunity()` のような集計メソッドを追加する。

**最終採用: PostRepository に `countsByCommunity()` を追加**

```typescript
interface PostRepository {
  // ...既存メソッド...
  /** コミュニティIDをキー、投稿数と最終投稿時刻をバリューとして返す集計（#527）。 */
  getStatsByCommunity(): Promise<Map<string, { postCount: number; lastPostAt: Date | null }>>;
}
```

Prisma実装: `groupBy` または `findMany` + `_count` で一発集計。
InMemory実装: 単純な reduce で集計。

### client 変更

`CommunityBrowseScene.tsx` のカードに追加:
- 投稿数: `{community.post_count} 件の投稿` — 0件なら `投稿なし`
- 最終投稿: `最終投稿: {相対時間}` — null なら `未投稿`

`PostedTime` コンポーネントを流用。

### OpenAPI フロー

1. `common/src/domain/community/community.ts` の `CommunitySchema` を更新
2. `server/src/openapi/registry.ts` は `CommunitySchema` を使っているので自動で更新される
3. `pnpm --filter @hatchery/server openapi` で `server/openapi.json` 再生成
4. `pnpm --filter @hatchery/client gen-types` で `client/src/api/openapi.gen.ts` 再生成

## 考慮事項

- **後方互換**: `post_count` と `last_post_at` をスキーマに必須追加するが、既存テストのモックデータは更新が必要。
- **パフォーマンス**: `getStatsByCommunity()` は全 post を対象とした一発集計。コミュニティ数・post数が増えても O(1) クエリで解決する。
- **0件の表示**: `post_count === 0` の場合は「投稿なし」と表示し、空状態を明示する。
- **`last_post_at` null**: 投稿が1件もないコミュニティは `null` を返し、「未投稿」と表示する。
