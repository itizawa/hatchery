# 設計書: コミュニティ詳細画面で全ワーカーをカーソルページネーション付き無限スクロールで表示する (#1078)

## 1. 目的 / 背景

現在の `CommunityScene.tsx` サイドバーは `GET /api/communities/{slug}/recent-workers`（`RECENT_WORKERS_LIMIT = 10` で固定 10 件・新着投稿から distinct author を集める実装）を表示している。
これは「コミュニティ所属の全ワーカー」ではなく「最近投稿した一部のワーカー」しか出ない。
一方、コミュニティ所属の全ワーカーを返すロジックは `WorkerCommunityRepository.listWorkersByCommunity` に既に存在するが非ページネーションかつ HTTP 未公開。
本 Issue はこれをカーソルページネーション対応に拡張し、新エンドポイント `GET /api/communities/{slug}/workers` として公開し、
クライアントを無限スクロールに置き換える。

## 2. スコープ

### やること

- common: `CommunityWorkersQuerySchema` / `CommunityWorkersResponseSchema` を追加。
- server: `WorkerCommunityRepository.listWorkersByCommunity` をオブジェクト引数 + カーソルページネーション対応に変更（InMemory / Prisma 両方）。
- server: `GET /api/communities/:slug/workers` を新設し OpenAPI に登録。
- server: 旧 `GET /api/communities/:slug/recent-workers` と `RECENT_WORKERS_LIMIT` を削除。
- server: `runPostBatch.ts` / `runCommentBatch.ts` の呼び出しを新シグニチャに追従（オプション省略で全件相当を取得）。
- client: `useCommunityWorkers`（`useSuspenseInfiniteQuery`）に置き換え、`IntersectionObserver` sentinel パターンで無限スクロール。
- e2e: `e2e/community/usecases.md`（UC-COMM-03 / UC-COMM-08）と `community.spec.ts` の対応するテストを新エンドポイント・新文言に追従。

### やらないこと

- ワーカーの並び替え（ソート順選択）・検索・フィルタ UI。
- worker ↔ community の紐付け編集（#490 の既存機能に変更なし）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `CommunityWorkersQuerySchema`: `cursor`（`string().max(512)` 任意）・`limit`（`1〜100` 既定 `20`）を検証する。
2. `CommunityWorkersResponseSchema`: `{ items: Worker[], nextCursor: string | null }`。
3. `WorkerCommunityRepository.listWorkersByCommunity({ communityId, limit?, cursor? })` が `{ items, nextCursor }` を返す。`id` 昇順で決定論的。`limit` 省略時は全件を `nextCursor: null` で返す（バッチ用途の後方互換）。`limit` 指定時はカーソルページネーションする。InMemory・Prisma 両方で同じ挙動。不正な `cursor` は `INVALID_CURSOR` エラーを投げる。
4. `GET /api/communities/:slug/workers`: 認証不要。`cursor`/`limit` クエリを検証し、community が無ければ 404、不正 cursor は 400。
5. 旧 `GET /api/communities/:slug/recent-workers` は削除（404 になる）。
6. OpenAPI に `/api/communities/{slug}/workers` が登録され `recent-workers` は登録から消える。
7. client: `useCommunityWorkers(slug)` が無限スクロールで全ページを取得できる。0 件時は既存の空状態文言を維持する。
8. client: サイドバーのワーカー一覧はスクロールで sentinel が交差すると `hasNextPage && !isFetchingNextPage` の場合のみ次ページを読み込む。
9. `pnpm turbo run build test lint` が全て緑。

## 4. 設計方針

- **カーソル方式**: post の cursor（`base64(JSON{createdAt,id})`）と異なり、ワーカーは日時を持たないため `id` 昇順一本のシンプルな比較にする。カーソルは `base64(JSON{id})`。`postRepository.ts` の `encodeCursor`/`decodeCursor` と同型のヘルパーを `workerCommunityRepository.ts` に追加する（`encodeWorkerCursor`/`decodeWorkerCursor`）。
- **`limit` 省略時に全件を返す**: `runPostBatch.ts` / `runCommentBatch.ts` は「コミュニティの全登場ワーカー」を前提にしたロジックのため、`limit` を渡さない呼び出しはページネーションをかけず全件を `items` に詰めて返す（`nextCursor: null` 固定）。HTTP ルータは常に `limit`（クエリの既定値 20）を渡すため、そちらは常にページネーションされる。
- **関数引数規約（#720）**: `listWorkersByCommunity` は `{ communityId, limit, cursor }` のオブジェクト引数 1 個にする。
- **ルータ DI**: `createCommunitiesRouter` は既存が位置引数 + `eslint-disable-next-line max-params`（グランドファザー済みパターン）のため、この既存パターンを踏襲し `workerCommunityRepo` を新しい位置引数として追加する（呼び出し元は `app.ts` の 1 箇所のみ）。
- **client**: `RecentWorkersPanel` / `RecentWorkersSection` を `CommunityWorkersPanel` / `CommunityWorkersSection` に改名。Panel 側で `useCommunityWorkers` + `IntersectionObserver` を持ち、Section は純表示のまま `sentinelRef` / `isFetchingNextPage` を追加 props として受け取る（`CommunityContent` の post 一覧と同じ sentinel パターン）。

## 5. 影響範囲（対象ワークスペース）

- **common**: `common/src/domain/community/communityWorkers.ts`（新規）, `index.ts`。
- **server**: `persistence/workerCommunityRepository.ts`, `persistence/prismaWorkerCommunityRepository.ts`, `routes/communities.ts`, `app.ts`, `batch/runPostBatch.ts`, `batch/runCommentBatch.ts`, `openapi/registrations/registerCommunities.ts`, `openapi/registrations/shared.ts`（コメント修正）。
- **client**: `api/communities.ts`, `components/RecentWorkersSection.tsx` → `CommunityWorkersSection.tsx`, `routes/CommunityScene.tsx`, `mocks/handlers.ts`, `mocks/data/fixtures.ts`。
- **docs**: `docs/design/issue-1078.md`（本ファイル）。
- **e2e**: `e2e/community/usecases.md`, `e2e/community/community.spec.ts`, `e2e/usecases.md`（サマリ行）。

## 6. テスト計画

- common: `communityWorkers.test.ts`（Query/Response スキーマの正常系・上限超過などの異常系）。
- server:
  - `workerCommunityRepository.test.ts`: 0 件・1 ページで収まる件数・複数ページで `nextCursor` が設定される・`limit` 省略で全件・不正 cursor でエラー。
  - `prismaWorkerCommunityRepository.test.ts`: 同等のページネーションケース（DB 統合テスト）。
  - `communities.test.ts`: `GET /:slug/workers` の cursor/limit・認証不要・404・400（不正 cursor）。旧 `recent-workers` の describe は削除。
- client:
  - `communities.test.ts`: `fetchCommunityWorkersPage` の正常系。
  - `CommunityWorkersSection.test.tsx`（旧 `RecentWorkersSection.test.tsx`）: 表示・空状態。
  - `CommunityScene.test.tsx`: 既存の recent-workers 関連ケースを新エンドポイント/query key に追従、スクロールで次ページ取得するケースを追加。

## 7. リスク・未決事項

- コミュニティ所属ワーカー数は MVP 規模では小さい（数人〜数十人想定）ため、無限スクロールの実運用効果は限定的だが、将来のワーカー増加に備えた設計として実装する。
- `listWorkersByCommunity` が「`limit` 有無で挙動が変わる」二重目的の API になっている点はやや複雑だが、バッチ用途（全件・順序不問）と HTTP 用途（ページネーション必須）の要求を 1 メソッドに統合するためのトレードオフとして許容する。
