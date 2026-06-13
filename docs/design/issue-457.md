# 設計書 Issue #457: community のアイコン・カバー画像と Reddit 風ヘッダー

## 背景・目的

community ごとにアイコン画像とカバー（ヘッダー）画像を設定でき、community 詳細画面を
Reddit 風ヘッダー（上部カバー＋左下に重ねた丸いアイコン＋name）で表示できるようにする。
権限は admin（運営）のみ（ADR-0018 / ADR-0020）。画像保存は ADR-0022（GCS / #204 のワーカー
アバター基盤）を community 向けに流用する。新規 ADR は不要（既存方針の踏襲）。

## 受け入れ条件 → 入出力への落とし込み

### 1. ドメイン / スキーマ（common）

- `CommunitySchema` に `iconUrl` / `coverUrl` を追加（任意・nullable）。
  - 型: `z.string().url().max(COMMUNITY_IMAGE_URL_MAX_LENGTH).nullable().optional()`
  - `COMMUNITY_IMAGE_URL_MAX_LENGTH = 500`（worker と同値・#91）。
- 入出力:
  - 有効な URL を持つ community を parse 成功。
  - `iconUrl: null` / 省略 でも parse 成功。
  - 不正な URL 形式は parse 失敗。
  - 500 文字ちょうど成功 / 501 文字失敗。
- `CreateCommunitySchema` は変更しない（作成時は画像なし。アップロードは別 API）。
- `UpdateCommunitySchema` も画像は対象外（アップロード API 経由でのみ設定）。

### 2. DB（server / prisma）

- `Community` に `iconUrl String?` / `coverUrl String?` を追加。
- マイグレーション `server/prisma/migrations/20260613110000_add_community_images/migration.sql`
  で `ALTER TABLE "Community" ADD COLUMN "iconUrl" TEXT;` 等を追加。
- `CommunityRecord` に `iconUrl: string | null` / `coverUrl: string | null` を追加。
- `UpdateCommunityRecordInput` に両フィールドを追加（アップロード API が画像 URL を永続化するため）。
- InMemory / Prisma 両実装の `create`（初期 null）・`update`・`toRecord` に反映。
- レスポンス変換 `toCommunityResponse`（admin.ts）に `icon_url`? いや snake_case 既存方針に合わせるが、
  Community スキーマのフィールド名は camelCase（`iconUrl` / `coverUrl`）で統一する。
  既存の `last_slot_key` 等は snake_case だが、新規フィールドは worker の `imageUrl` と同じく camelCase を採用し
  `CommunitySchema` の定義と一致させる（OpenAPI 経由でそのまま client に流れる）。
  → レスポンスでは `iconUrl: r.iconUrl ?? null` / `coverUrl: r.coverUrl ?? null` を返す。

### 3. アップロード API（server）

- 雛形: `adminWorkerImage.ts`。`createAdminCommunityImageRouter(communityRepository, storageService)`。
- エンドポイント（admin 必須）:
  - `POST /api/admin/communities/:id/icon` … アイコン
  - `POST /api/admin/communities/:id/cover` … カバー
- multer メモリ保存・MIME 制限（png/jpeg/webp/gif）・5MB 上限は worker と共通定数を流用。
- 保存先 URL を `Community.iconUrl` / `coverUrl` に永続化して `{ id, iconUrl }` / `{ id, coverUrl }` を返す。
- GCS 命名規約: `communities/{communityId}/icon|cover/{uuid}.{ext}`。
- 入出力（テスト）:
  - 未認証 401 / member 403 / admin 成功 200 + URL。
  - 存在しない community 404。
  - 不正 MIME 400 / 5MB 超 400 / ファイル無し 400。
  - 成功時に repository に URL が永続化されている。

### 4. StorageService 拡張

- インターフェースに `uploadCommunityImage(input)` を追加。
  - `input: { communityId: string; kind: "icon" | "cover"; mimeType: string; buffer: Buffer }`
  - 命名: `communities/{communityId}/{kind}/{uuid}.{ext}`。
- `GcsStorageService` / `InMemoryStorageService` 両方に実装。

### 5. 権限

- `requireAuth` + `requireAdmin` をルートに適用（worker image と同一）。テストで 401/403/200 を担保。

### 6. OpenAPI 一方向フロー

- multipart アップロードは worker 同様 client では fetch 直呼びにするため、
  registry への登録は必須ではないが、ドキュメント整合のため community の icon/cover パスを登録する。
  `CommunitySchema` に icon/cover が増えるため `Community` コンポーネントは自動で反映される。
- `pnpm --filter @hatchery/server openapi` → `pnpm --filter @hatchery/client gen-types` が成功すること。

### 7. admin 編集 UI（client）

- `CommunitiesTab.tsx` の編集フォーム（`EditCommunityForm`）に、アイコン・カバーの
  アップロード UI を追加。worker の `WorkerImageUpload.tsx` を流用した汎用
  `CommunityImageUpload`（icon は丸 Avatar / cover は横長矩形）を新規作成。
- `client/src/api/communities.ts` に `uploadCommunityImage`（fetch 直呼び）と
  `useUploadCommunityIcon` / `useUploadCommunityCover` フックを追加。成功時に admin 一覧を invalidate。
- フォーム本体（name/description）は引き続き `@tanstack/react-form`。画像アップロードは
  フォーム送信とは独立した即時アップロード（worker と同じ UX）なので useForm 規約に反しない。

### 8. 詳細画面の表示（client）

- `CommunityScene.tsx` に Reddit 風ヘッダーを追加する presentational
  `CommunityHeader` コンポーネントを新規作成。
  - カバー画像を上部に表示（未設定はテーマ色のプレースホルダ矩形）。
  - その左下に丸いアイコン（MUI Avatar・未設定は name 頭文字フォールバック）を重ねる。
  - name を並べる。
- `CommunitySidebarCard.tsx` にもアイコン（小さめ Avatar）を name の隣に表示。

### 9. テスト

- common: `CommunitySchema` の iconUrl/coverUrl（url/nullable/max）。
- server: アップロード API（権限・成功永続化・MIME・サイズ・404）、InMemoryStorageService の community 保存、
  community repository の update で iconUrl/coverUrl が反映されること。
- client: `CommunityHeader` の画像あり/なしレンダリング、`CommunitySidebarCard` のアイコン表示、
  `CommunityImageUpload` の基本レンダリング。

### 10. 全タスク緑・import 境界維持

## 設計判断

- **フィールド命名**: 新規 `iconUrl` / `coverUrl` は camelCase。worker の `imageUrl` と統一し、
  Zod スキーマ定義＝API レスポンス＝client 型を一致させ snake_case 変換の認知負荷を避ける。
  既存の `last_slot_key` 等の snake_case は触らない（後方互換）。
- **アップロード API を 2 エンドポイント**に分離（icon/cover）。Issue の例示に従い、
  multipart の単一フィールド `image` を流用しルートで kind を決める（StorageService に kind を渡す）。
- **画像更新は専用アップロード API のみ**。`UpdateCommunitySchema`（PATCH ボディ）には画像を含めない。
  ただし repository の `update` 入力には iconUrl/coverUrl を持たせ、アップロード API から呼ぶ。
- **client の画像アップロードは fetch 直呼び**（openapi-fetch は multipart 非対応・worker と同じ）。
- **ユーザー可視挙動が変わる**（詳細画面ヘッダー / admin 編集 UI）ため e2e usecases を更新する。

## e2e への反映

- community エリア: UC-COMM-07（詳細画面に Reddit 風ヘッダー＝カバー＋アイコン、未設定でも崩れない）。
- admin エリア: UC-ADMIN-10（admin がコミュニティのアイコン・カバー画像をアップロードできる）。
