# 設計書: community に非公開の「生成プロンプト指示」フィールドを新設 (#488)

## 1. 目的 / 背景

`community.description`（公開情報）がプロンプトへのトーン指示と公開概要を兼ねており、
内部指示が `GET /api/communities` 経由でユーザーに丸見えになっている。
新フィールド `generationInstruction`（非公開）を admin のみが設定・閲覧できるようにし、
定時バッチはそちらを参照する。`description` は公開用概要に戻す。

## 2. スコープ

やること:
- DB: `Community.generationInstruction String?` 追加（Prisma マイグレーション）
- common: `AdminCommunitySchema`（`generationInstruction` 含む）新設。公開 `CommunitySchema` には含めない
- server: 公開 API は `generationInstruction` を返さない。admin API は返す
- batch: `generationInstruction ?? description` にフォールバック参照
- client: CommunitiesTab に「生成プロンプト指示（非公開）」フィールド追加

やらないこと:
- 生成プロンプトのテンプレート化・バージョン管理
- community ごとの登場ワーカー指定（別 Issue）
- 成長メカニクス（ADR-0023 厳守）

## 3. 受け入れ条件

1. `Community.generationInstruction` が DB に nullable フィールドとして存在し、既存行は null
2. `CommunitySchema`（公開）には `generationInstruction` を含まない
3. `AdminCommunitySchema` には `generationInstruction?: string.max(2000)` を含む
4. `CreateCommunitySchema` / `UpdateCommunitySchema` に `generationInstruction` (optional, max 2000) を追加
5. `GET /api/communities`・フィード等の公開エンドポイントのレスポンスに `generationInstruction` が存在しない
6. admin CRUD (`POST`/`PATCH`/`GET /api/admin/communities`) では `generationInstruction` を設定・取得できる
7. `buildCommunityPrompt` が `generationInstruction` を参照し、null なら `description` にフォールバックする
8. `CommunitiesTab.tsx` に「生成プロンプト指示（管理者のみ・非公開）」フィールドが追加される
9. `e2e/admin/usecases.md` に UC-ADMIN-14（生成プロンプト指示の設定）が追記される
10. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 公開/admin スキーマ分離

```
common:
  CommunitySchema        (公開)  ← generationInstruction なし
  AdminCommunitySchema   (admin) ← CommunitySchema を extends + generationInstruction
  CreateCommunitySchema           ← generationInstruction optional
  UpdateCommunitySchema           ← generationInstruction optional

server:
  toCommunityResponse()      → generationInstruction を含まない（公開エンドポイント用）
  toAdminCommunityResponse() → generationInstruction を含む（admin エンドポイント用）
```

### batch のフォールバック

```typescript
const toneInstruction = community.generationInstruction ?? community.description;
// プロンプト内 "コミュニティ作風:" のセクションを toneInstruction で置き換え
```

### client の型

`CommunitiesTab.tsx` は admin API を使うため `AdminCommunity` 型（`generationInstruction` 含む）で動く。
`fetchAdminCommunities` のパース先を `AdminCommunitySchema` に変更する。

## 5. 影響範囲

- `common/src/domain/community/community.ts` — スキーマ追加
- `server/prisma/schema.prisma` — フィールド追加
- `server/prisma/migrations/` — マイグレーション追加
- `server/src/persistence/communityRepository.ts` — `CommunityRecord` / 入力型追加
- `server/src/persistence/prismaCommunityRepository.ts` — Prisma マッピング
- `server/src/routes/communityResponse.ts` — `toAdminCommunityResponse` 追加
- `server/src/routes/admin.ts` — `toAdminCommunityResponse` に切替
- `server/src/batch/buildCommunityPrompt.ts` — 参照先変更
- `server/src/openapi/registry.ts` — `AdminCommunity` スキーマ登録
- `client/src/api/communities.ts` — `AdminCommunitySchema` でパース
- `client/src/components/CommunitiesTab.tsx` — フォームフィールド追加
- `e2e/admin/usecases.md` — UC-ADMIN-14 追加

## 6. テスト計画（TDD）

| テストファイル | テストケース |
|---|---|
| `common/.../community.test.ts` | `CreateCommunitySchema` が generationInstruction を受け入れる / 2001文字で reject / `CommunitySchema` は generationInstruction を含まない / `AdminCommunitySchema` は含む |
| `server/.../communities.test.ts` | 公開 GET に `generationInstruction` キーが存在しない |
| `server/.../admin.communities.test.ts` | 作成時に `generationInstruction` を設定できる / 更新できる / 一覧に含まれる |
| `server/.../buildCommunityPrompt.test.ts` | `generationInstruction` があればプロンプトに含まれる / null なら `description` にフォールバック |

## 7. リスク・未決事項

- 既存の develop DB (`hatchery` community) の `description` には長文トーン指示が埋め込まれている。
  本 PR マージ後に admin 画面 or SQL で `generationInstruction` へ移行する必要がある（PR 本文に明記）。
- `#487`（共通トーン規約）も `buildCommunityPrompt.ts` を触る。並行実装時の競合に注意。
