# 設計書: 管理者がコミュニティ詳細画面でワーカーの所属を編集できるようにする (#1079)

## 1. 目的 / 背景

ワーカーの参加コミュニティ編集は現状 **ワーカー起点**（#490）でのみ実装されている。逆方向（コミュニティ編集画面から、そのコミュニティに所属するワーカーを編集する）は未実装。#490 が使う `WorkerCommunity` 中間テーブルはそのまま流用し、コミュニティ起点の CRUD を追加することで、どちらの画面から編集しても同じデータに反映されるようにする。

## 2. スコープ（やること / やらないこと）

**やること**

- common: コミュニティ起点の workerIds 集合スキーマ（`SetCommunityWorkersSchema`）と、GET/PUT レスポンス用の worker summary スキーマ（`CommunityWorkerAssignmentsSchema`）を追加する。
- server: `WorkerCommunityRepository` にコミュニティ起点のメソッド（一覧取得・置換）を追加し、InMemory / Prisma 双方に実装する。
- server: `GET /api/admin/communities/:id/workers` と `PUT /api/admin/communities/:id/workers` を admin 限定で追加する。
- server: OpenAPI レジストリに登録し、baseline snapshot を更新する。
- client: 新規 API クライアント（`communityWorkers.ts`）・選択 UI（`CommunityWorkersSelect` / `CommunityWorkersField`）・`EditCommunityScene.tsx` への統合。
- e2e: `e2e/admin/usecases.md` に UC を追記する。

**やらないこと（スコープ外）**

- コミュニティ一覧から所属ワーカー数を表示するサマリ UI（Issue 補足に明記の将来拡張）。
- 非 admin 向けの所属閲覧 UI（既存の `GET /api/communities/{slug}/workers`・#1078 で対応済み）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `common`: `SetCommunityWorkersSchema`（`{ workerIds: string[] }`、要素は `WORKER_COMMUNITY_ID_MAX_LENGTH` で `.max()`、配列全体は新規定数 `COMMUNITY_WORKERS_MAX`（200）で `.max()`）を追加。境界値テスト（空配列・上限ちょうど・上限超過・不正要素長）を common で検証する。
2. `server` persistence: `WorkerCommunityRepository` に `listWorkerSummariesByCommunity(communityId): Promise<{id, displayName}[]>` と `setCommunityWorkers(communityId, workerIds): Promise<void>` を追加し、InMemory 実装で以下を満たす:
   - 紐づきが無ければ空配列。
   - 論理削除済み worker は一覧から除外する。
   - id 昇順で返す。
   - `setCommunityWorkers` は既存紐づきを全置換する（重複除去・冪等）。
3. `server` persistence（Prisma）: 上記 2 メソッドを `$transaction` で原子的に実装し、`prismaWorkerCommunityRepository.test.ts` の既存パターンに追従したテストを追加する。
4. `server` routes: `server/src/routes/adminCommunityWorkers.ts` を新設し `requireAdminAccess` を必須にする。
   - `GET /api/admin/communities/:id/workers` — 対象コミュニティが存在しなければ 404、存在すれば `{ workers: [{id, displayName}] }` を返す。
   - `PUT /api/admin/communities/:id/workers` — `SetCommunityWorkersSchema` でバリデーション、コミュニティ不存在は 404、存在しない workerId を含む場合は 400、成功時は置き換え後の一覧を返す。
   - 未認証 401 / member 403 のテストを含める（`adminWorkerCommunities.test.ts` と同じ形）。
5. `server` openapi: 上記 2 エンドポイントを `registerCommunities.ts` に登録し、`registry.snapshot.test.ts` の baseline fixture を更新する。
6. `client`: `client/src/api/communityWorkers.ts` に `fetchCommunityWorkerAssignments` / `setCommunityWorkerAssignments` / `useCommunityWorkerAssignments` / `useSetCommunityWorkerAssignments` を追加する（`workerCommunities.ts` と対称のテスト構成）。
7. `client`: `CommunityWorkersSelect.tsx`（プレゼンテーション。全 Bot Worker から複数選択・上限 `COMMUNITY_WORKERS_MAX`）と `CommunityWorkersField.tsx`（`useBotWorkers` を `QueryBoundary` でラップ）を追加する。`WorkerCommunitiesSelect.test.tsx` と対称のテスト構成にする。
8. `client`: `EditCommunityScene.tsx` に「所属ワーカー」セクションを追加する。独立した `useForm` + 独立した保存ボタンを持ち（メインのコミュニティ編集フォームとは別送信単位）、現在の所属を初期値として反映し、保存すると `PUT` が呼ばれる。
9. `e2e`: `e2e/admin/usecases.md` に UC-ADMIN-29 を追記する。
10. `pnpm turbo run build test lint` が緑であること。client → common / server → common の一方向 import 境界を守る。

## 4. 設計方針

- **命名の意図的な逸脱**: Issue 本文は `listWorkerIdsByCommunity(communityId): Promise<string[]>` を例示するが、ルーターの GET レスポンスは `id`・`displayName` を含む必要がある（受け入れ条件 3）。id のみを返す既存の `listCommunityIdsByWorker`（ワーカー起点）とは非対称になるため、リポジトリメソッドは返り値の実態に即して `listWorkerSummariesByCommunity` と命名する。
- **クエリ/永続化**: 既存の `listWorkersByCommunity`（#1078・カーソルページネーション・バッチ/公開 API 向け）とは別メソッドとして追加する。admin 編集画面は全件を Select で一覧表示する想定でページネーション不要なため、`workerCommunityRepository.listWorkerSummariesByCommunity` は非ページネーションで id 昇順・論理削除済み除外の summary（`id`, `displayName`）を返す。
- **router**: `adminWorkerCommunities.ts` と同じ構成（`requireAdminAccess` ミドルウェア・`validateBody`・存在チェック→400/404）を踏襲する。`createAdminCommunityWorkersRouter(communityRepository, workerCommunityRepository, workerRepository)` を `server/src/app.ts` の `/api/admin` 配下にマウントする。
- **openapi**: 新規 component (`CommunityWorkerSummary`, `CommunityWorkerAssignments`, `SetCommunityWorkers`) を `registerCommunities.ts` の admin コミュニティ CRUD セクション付近に追加する（community 起点のため `registerWorkers.ts` ではなく `registerCommunities.ts` に置く）。
- **client の hook 命名衝突回避**: `communities.ts` に既存の `useCommunityWorkers(slug)`（#1078・公開 API・カーソルページネーション）が存在するため、新規の admin 編集用フックは `useCommunityWorkerAssignments(communityId)` / `useSetCommunityWorkerAssignments()` と命名し衝突を避ける。
- **EditCommunityScene への統合**: 独立した保存単位でよい（受け入れ条件 7）ため、`EditCommunityForm` とは別に `CommunityWorkersEditSection` ローカルコンポーネントを設け、独自の `useForm` とその場限りの保存ボタンを持たせる。

## 5. 影響範囲 / 既存への変更

- **common**: `common/src/domain/worker/workerCommunity.ts`（追加のみ・既存 export は変更しない）。
- **server**: `persistence/workerCommunityRepository.ts`（InMemory 実装拡張）・`persistence/prismaWorkerCommunityRepository.ts`（Prisma 実装拡張）・新規 `routes/adminCommunityWorkers.ts`・`app.ts`（マウント追加）・`openapi/registrations/registerCommunities.ts`・`openapi/__fixtures__/openapi.baseline.json`（再生成）。
- **client**: 新規 `api/communityWorkers.ts`・新規 `components/CommunityWorkersSelect.tsx` / `components/CommunityWorkersField.tsx`・`routes/EditCommunityScene.tsx`（セクション追加）。
- **docs**: `e2e/admin/usecases.md` に UC 追記。

## 6. テスト計画（TDD で書くテスト一覧）

- common: `domain/worker/workerCommunity.test.ts` に `SetCommunityWorkersSchema` の境界値テストを追加。
- server: `persistence/workerCommunityRepository.test.ts`（InMemory）に一覧取得・置換のテストを追加。
- server: `persistence/prismaWorkerCommunityRepository.test.ts` に同等の Prisma 実装テストを追加。
- server: 新規 `routes/adminCommunityWorkers.test.ts`（401/403/404/400/200 の全パターン）。
- server: `openapi/registry.snapshot.test.ts` の baseline を新エンドポイント込みで再生成し一致を確認。
- client: 新規 `api/communityWorkers.test.ts`（fetch/set の成功・失敗）。
- client: 新規 `components/CommunityWorkersSelect.test.tsx`（`WorkerCommunitiesSelect.test.tsx` と対称の (a)〜(f) ケース）。
- client: `routes/EditCommunityScene.test.tsx` に所属ワーカーセクションの表示・保存呼び出しテストを追加。

## 7. リスク・未決事項

- 所属ワーカー数の上限 `COMMUNITY_WORKERS_MAX` は明確な運用上限が Issue に無いため、表示・DB 負荷を考慮し 200 を暫定値として設定する（既存の `WORKER_COMMUNITIES_MAX = 100` より緩め。1 コミュニティに複数ワーカーが所属し得る運用を想定）。将来的に見直しが必要になれば別 Issue で対応する。
- 所属ワーカー編集の保存は「所属ワーカー」セクション独自の保存ボタンで完結させ、公開の read-only ロスター（`GET /api/communities/{slug}/workers`・#1078）のキャッシュは自然な `staleTime` 経過で追従させる（即時無効化はスコープ外とする）。
