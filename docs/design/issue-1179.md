# 設計書: PostRepository/PrismaPostRepository のカーソルページネーション実装重複をヘルパー抽出で解消する (#1179)

## 1. 目的 / 背景

`server/src/persistence/postRepository.ts`（インメモリ実装）と `server/src/persistence/prismaPostRepository.ts`（Prisma 実装）は、`listByCommunityPaged` / `listByCommunityPopularPaged` / `listLatestPaged` / `listPopularPaged` の4メソッドで「cursor decode → INVALID_CURSOR チェック → フィルタ → sort/where構築 → limit+1取得 → hasMore判定 → nextCursor encode」という同一パターンを4回ずつ繰り返している。

さらに人気順ソート（score降順→createdAt降順→id降順）の基準が、インメモリ側は `comparePopular` として単一情報源化されている一方、Prisma側は `listByCommunityPopularPaged`・`listPopularPaged` の2箇所に個別の `where` 条件として手書きされており、ソート基準変更時に片方だけ直して漏れるリスクがある。

## 2. スコープ（やること / やらないこと）

**やること**
- インメモリ実装（`postRepository.ts`）: 4メソッド共通の「cursor decode・keysetフィルタ・limit+1取得・hasMore判定・nextCursor encode」を共通ヘルパーに抽出する。
- インメモリ実装: `listByCommunityPaged` / `listLatestPaged` のソート比較関数を `comparePopular` と同様に単一関数（`compareRecent`）へ抽出する。
- Prisma 実装（`prismaPostRepository.ts`）: cursor decode・keyset `where` 構築・limit+1取得・hasMore判定・nextCursor encode を共通ヘルパーに抽出する。
- Prisma 実装: 人気順 keyset 条件（score→createdAt→id）を単一ヘルパー（`withPopularCursor`）に集約し `listByCommunityPopularPaged`・`listPopularPaged` の両方から再利用する。
- 挙動を変えないことを既存テスト（`postRepository.test.ts` 無変更・全緑）で担保する。

**やらないこと**
- ページネーションの仕様（limit 値・cursor 形式・ソート順自体）の変更。
- `commentRepository.ts`・`workerRepository.ts` 等、他リポジトリの同様パターンの是正（別 Issue）。
- `createMany` / `listTopByCommunity` 等、カーソルページネーションを使わないメソッドの変更。

## 3. 受け入れ条件（Issue 本文より）

1. `postRepository.ts`（インメモリ）で4メソッド共通のページネーション処理を1つの共通ヘルパー関数に抽出する。
2. `prismaPostRepository.ts` で人気順ソート条件を単一ヘルパーに集約し、`listByCommunityPopularPaged`・`listPopularPaged` の両方から再利用する。
3. リファクタ後も既存の `postRepository.test.ts`・`prismaPostRepository.test.ts` の全ケースが変更無しでパスする。
4. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針

### 4.1 インメモリ側（`postRepository.ts`）

- `compareRecent(a, b)`: 新着順（createdAt 降順 → id 降順）比較関数。`comparePopular` と対になる形で追加し、`listByCommunityPaged`・`listLatestPaged` のインライン `.sort()` を置き換える。
- `matchesCursorRecent(record, cursor: CursorPayload)` / `matchesCursorPopular(record, cursor: PopularCursorPayload)`: keyset 判定述語。既存のインライン cursor フィルタ処理と同一ロジック。
- `paginateSorted<T, C>({ sorted, cursor, limit, decode, matchesCursor, encode })`: 4メソッド共通のページネーション処理。
  - `cursor` が `undefined` でなければ `decode` して `null` なら `throw new Error("INVALID_CURSOR")`。
  - cursor payload があれば `matchesCursor` で `sorted` をフィルタ。
  - `limit + 1` 件取得 → `hasMore` 判定 → `slice(0, limit)` → 最後の要素を `encode` して `nextCursor`。
  - 戻り値 `{ posts, nextCursor }`（`posts` は生レコード。呼び出し側で `cloneRecord` して返す）。
  - 4メソッドはすべて非 `async` から `async` 関数に変更する（`Promise.reject` の代わりに `throw` を使うため。`throw` は `async` 関数内でのみ自動的に rejected promise になる。`.rejects.toThrow` によるテストの互換性は維持される）。

### 4.2 Prisma 側（`prismaPostRepository.ts`）

- `RECENT_ORDER_BY` / `POPULAR_ORDER_BY`: 既存の `orderBy` 配列リテラルを定数化。
- `withRecentCursor({ where, cursor })`: cursor decode + `createdAt`/`id` keyset の `AND`/`OR` 条件を既存 `where` にマージして返す。invalid cursor は `throw new Error("INVALID_CURSOR")`。
- `withPopularCursor({ where, cursor })`: 同様に `score`/`createdAt`/`id` keyset 条件をマージ。`listByCommunityPopularPaged`・`listPopularPaged` の両方がこれを使うことで、人気順の keyset 条件が単一情報源になる。
- `findPage({ prisma, where, orderBy, limit, encode })`: `findMany` で `limit + 1` 取得 → `hasMore` 判定 → `slice` → `encode` → `{ posts, nextCursor }` を返す共通ヘルパー。
- 4メソッドは「`where` のベース条件（community/now/exclude）を組み立てる → `withXxxCursor` でカーソル条件をマージ → `findPage` で取得」という3行程度の薄い実装になる。

### 4.3 TDD の扱い（本 Issue 固有の注記）

本 Issue は「振る舞いを変えないリファクタ」であり、新規の外部振る舞いを追加しない。CLAUDE.md の TDD 方針における「テストに落とせる受け入れ条件」は既存の `postRepository.test.ts`（70 tests）・`prismaPostRepository.test.ts`（32 tests、CI の DATABASE_URL 環境でのみ実行）がそのまま担う。したがって：

1. まずベースライン確認として、リファクタ前の状態で既存テストを実行し全緑であることを確認する（実施済み・70 tests green / Prisma 側は 32 tests skip、DATABASE_URL 未設定のローカル環境のため）。
2. リファクタを行う。
3. 既存テストを**一切変更せず**再実行し、全緑であることを確認する。

新しいテストファイルは追加しない（新規の観測可能な振る舞いが無いため）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server` のみ。
- 変更ファイル: `server/src/persistence/postRepository.ts`、`server/src/persistence/prismaPostRepository.ts`。
- 公開インターフェース（`PostRepository`）・呼び出し元（routes/batch 等）への影響はない（内部実装のみの変更）。
- OpenAPI・client への影響はない。

## 6. テスト計画

- 新規テストは追加しない（振る舞い変更が無いため）。
- 既存 `postRepository.test.ts`（70 tests）・`prismaPostRepository.test.ts`（32 tests、CI で DATABASE_URL 注入時に実行）を無変更のまま実行し、全緑を確認する。
- `pnpm turbo run build test lint` を実行して全体の回帰が無いことを確認する。

## 7. リスク・未決事項

- Prisma 側の統合テストはこのローカル worktree 環境（DATABASE_URL 未設定・Docker 未起動）では実行できないため、型チェック・lint・コードレビューで正確性を担保し、実際の実行確認は CI（PostgreSQL サービスコンテナ + DATABASE_URL 注入）に委ねる。
- 非 `async` → `async` への変更は `INVALID_CURSOR` の reject 方法を `Promise.reject(...)` から `throw` に変えるが、呼び出し側は既存どおり Promise を返すインターフェースのまま・`.rejects.toThrow` によるテストの結果は変わらないため後方互換。
