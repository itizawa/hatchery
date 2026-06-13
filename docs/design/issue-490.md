# 設計書: Issue #490 管理画面のワーカー設定で参加コミュニティ（WorkerCommunity）を編集できるようにする

## 背景・目的

ワーカーがどの community に参加するかは `WorkerCommunity`（worker ↔ community の参加テーブル・#489 で導入済み）で表現するが、現状その編集手段が無い。admin は `EditWorkerDialog` / `AddWorkerDialog` でワーカーの表示名・役割・性格・画像を編集できるが、**参加コミュニティを選んで編集することはできない**。

定時バッチが `WorkerCommunity` 経由で community 別ワーカーを解決する基盤（#489・develop に取り込み済み）が入ったため、「どのワーカーをどの community に出すか」を admin が編成できる UI を本 Issue で追加する。

## スコープ

- IN:
  - server: 指定ワーカーの参加コミュニティ一覧を取得（GET）/ 置き換え set（PUT）する admin API。common Zod → openapi.json → client 型生成の一方向フローに乗せる。
  - `WorkerCommunityRepository` に編集系メソッド（`listCommunityIdsByWorker` / `setWorkerCommunities`）を追加（InMemory + Prisma）。
  - common: リクエスト/レスポンス Zod スキーマ（`SetWorkerCommunitiesSchema` / `WorkerCommunityIdsSchema`）。
  - client: `EditWorkerDialog` / `AddWorkerDialog` に「参加コミュニティ」複数選択 UI を追加し、TanStack Query で取得・保存。`@tanstack/react-form` でフォーム管理。
  - e2e: admin エリア usecases に UC を追記。
- OUT: 生成バッチ側のワーカー選定ロジック（#489 で実装済み・別 Issue）。`WorkerCommunity` のデータモデル自体（既存を利用）。

## API 設計（受け入れ条件 1・2）

worker のサブリソースとして community 集合を扱う。admin 権限必須（`requireAuth` + `requireAdmin`）。

### GET `/api/admin/workers/{id}/communities`

- 指定ワーカーが参加する community の id 配列を返す。
- レスポンス: `{ communityIds: string[] }`（`WorkerCommunityIdsSchema`）。
- ワーカーが存在しない場合は 404（`WorkerNotFound`）。

### PUT `/api/admin/workers/{id}/communities`

- 指定ワーカーの参加コミュニティを **置き換え（set セマンティクス）** する。リクエストの集合で `WorkerCommunity` を全置換する（差分計算はリポジトリ内で実施・冪等）。
- リクエストボディ: `{ communityIds: string[] }`（`SetWorkerCommunitiesSchema`）。
- バリデーション（Zod）:
  - `communityIds` は文字列 id の配列。各要素は `.min(1).max(64)`（uuid7 を想定。ユーザーが自由入力する文字列ではないが #91 に倣い `.max()` を付与）。
  - 配列サイズ上限 `WORKER_COMMUNITIES_MAX = 100`（`.max(100)`）。重複は許容し、リポジトリ側で一意化する。
- 存在しない `communityId` が含まれる場合は 400（`InvalidCommunityId`）。存在チェックは route 層で `communityRepository.findById` を使って行う。
- ワーカーが存在しない場合は 404（`WorkerNotFound`）。
- レスポンス: 置換後の `{ communityIds: string[] }`（200）。

新規ワーカー作成（`AddWorkerDialog`）では、まず `POST /api/admin/workers` で作成し、作成された worker id に対して `PUT /api/admin/workers/{id}/communities` を呼んで参加コミュニティを設定する（2 ステップ）。

## 永続化層（受け入れ条件 1・5）

`WorkerCommunityRepository`（`server/src/persistence/workerCommunityRepository.ts`）に追加:

```ts
/** 指定ワーカーが参加する community の id 一覧を返す（作成順は問わない）。 */
listCommunityIdsByWorker(workerId: string): Promise<string[]>;
/** 指定ワーカーの参加コミュニティを communityIds で全置換する（set セマンティクス・冪等）。 */
setWorkerCommunities(workerId: string, communityIds: readonly string[]): Promise<void>;
```

- InMemory 実装: `links` 配列を対象 worker について全削除→ユニーク化した `communityIds` で再構築。
- Prisma 実装: トランザクション内で `deleteMany({ where: { workerId } })` → `createMany({ data: uniqueIds.map(...), skipDuplicates: true })`。

## common スキーマ（受け入れ条件 1・2）

`common/src/domain/worker/workerCommunity.ts` を新設:

```ts
export const WORKER_COMMUNITIES_MAX = 100;
export const WORKER_COMMUNITY_ID_MAX_LENGTH = 64;

export const WorkerCommunityIdsSchema = z.object({
  communityIds: z.array(z.string().min(1).max(WORKER_COMMUNITY_ID_MAX_LENGTH)).max(WORKER_COMMUNITIES_MAX),
});
export type WorkerCommunityIds = z.infer<typeof WorkerCommunityIdsSchema>;

// リクエストは同形（set 用）。意味付けのため別名でエクスポート。
export const SetWorkerCommunitiesSchema = WorkerCommunityIdsSchema;
export type SetWorkerCommunitiesInput = z.infer<typeof SetWorkerCommunitiesSchema>;
```

`common/src/domain/worker/index.ts` から re-export し、OpenAPI registry に登録する。

## client（受け入れ条件 3・4）

- `client/src/api/workerCommunities.ts` を新設:
  - `useWorkerCommunities(workerId)` … GET。`["admin","workers",workerId,"communities"]` をキーに participant id 配列を取得。
  - `useSetWorkerCommunities()` … PUT。成功時に該当 worker の communities クエリ + Bot worker キャッシュを invalidate。
- `EditWorkerDialog`:
  - `useCommunities()`（既存 admin communities フック）で全 community を取得し複数選択肢にする。
  - `useWorkerCommunities(worker.id)` で現在の参加 community を取得し `defaultValues.communityIds` に流し込む（取得完了まで Select を disabled/ローディング）。
  - `@tanstack/react-form` の `form.Field name="communityIds"` で配列を管理。MUI `Select multiple`（`renderValue` で Chip 表示・各 `MenuItem` に Checkbox）。
  - 保存時: 既存の worker 更新（PATCH）に加えて `setWorkerCommunities` を呼ぶ。両方成功で close。
- `AddWorkerDialog`:
  - 同様に community 複数選択を追加（`form.Field name="communityIds"`、初期値 `[]`）。
  - 送信時: 作成 → 返ってきた id に対し `setWorkerCommunities` を呼ぶ。
- 反映: mutation の `onSuccess` で関連クエリを invalidate（受け入れ条件 4）。

## テスト計画（TDD・受け入れ条件 5）

1. common: `workerCommunity.test.ts`
   - 正常系（id 配列を受理）/ 空配列許容 / 上限超過（101 件）で reject / id 空文字 reject / id 長すぎ reject。
2. server persistence: `workerCommunityRepository.test.ts`（InMemory）に追記
   - `setWorkerCommunities` で置換される / 重複 id は一意化 / `listCommunityIdsByWorker` が設定値を返す / 他 worker の紐づきに影響しない。
   - Prisma 統合テスト（`prismaWorkerCommunityRepository.test.ts`・DATABASE_URL がある時のみ）に set/list を追記。
3. server route: `adminWorkerCommunities.test.ts`
   - 未認証 401 / 非 admin 403 / 存在しない worker で GET・PUT 404 / 存在しない communityId を含む PUT で 400 / 正常 PUT で 200 + 置換後 id 返却 / GET が設定値を返す / 上限超過 400。
4. client: `EditWorkerDialog.test.tsx` / `AddWorkerDialog.test.tsx` に community 選択 UI のレンダリングと送信時の API 呼び出しを追記。

## 影響範囲・互換性

- `AppDeps` に `workerCommunityRepository` を追加（`createTestDeps` / `createPrismaDeps` を更新）。`createApp` に新 router をマウント。
- 既存の GET `/api/workers`・PATCH `/api/workers/:id` 等の挙動は不変。
- 一方向 import 境界（client→common / server→common）を維持。
