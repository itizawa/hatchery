# 設計書: ワーカーランキング一覧にワーカー画像（アバター）を表示する (#956)

## 1. 目的 / 背景

ワーカーランキング一覧（`/ranking`）は他のワーカー一覧（RecentWorkersSection・WorkerTable・AuthorByline）と異なり、アバター画像を表示していない唯一の一覧。
API レスポンス（`WorkerRankingItemSchema`）に `imageUrl` が含まれておらず、クライアント側でも Avatar が未実装。
本 Issue でスキーマ・サーバ・クライアントの一方向フローに沿って `image_url` を追加し、視覚的なワーカー識別を一貫させる。

## 2. スコープ（やること / やらないこと）

**やること**:
- `WorkerRankingItemSchema` に `image_url: z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).nullable()` を追加
- `GET /api/workers/ranking` ハンドラで `image_url: w.imageUrl ?? null` を返す
- `WorkerRankingScene.tsx` の `RankingRow` で MUI `Avatar` を表示（`resolveWorkerImageUrl` 使用）
- 関連テスト・e2e ユースケースを更新

**やらないこと**:
- ランキング画面レイアウト全体の刷新
- ソート指標・並び順の変更
- Avatar サイズの統一化（別 Issue）
- DiceBear → Boring Avatars 移行（Issue #959 が別途対応）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `WorkerRankingItemSchema` の `image_url` フィールドが null・URL 文字列ともにパース成功する
2. `image_url` が 501 文字以上の URL だと reject する（WORKER_IMAGE_URL_MAX_LENGTH=500）
3. `GET /api/workers/ranking` レスポンスの各アイテムに `image_url` が含まれる
4. `WorkerRankingScene` の各ランキング行に `Avatar`（alt=表示名）が表示される
5. `image_url: null` のとき表示名の頭文字がフォールバックとして Avatar 内に表示される
6. 空状態（データ 0 件）の挙動は変わらない
7. 全テスト緑・lint 通過

## 4. 設計方針

### データフロー（OpenAPI 一方向フロー遵守）
```
common: WorkerRankingItemSchema に image_url 追加
  → server: openapi.json 再生成（image_url が paths に追加）
  → client: gen-types で openapi.gen.ts 再生成（型安全参照）
  → client: resolveWorkerImageUrl({ id: worker_id, imageUrl: image_url }) で Avatar src を解決
```

### Avatar 表示パターン（RecentWorkersSection に倣う）
```tsx
<Avatar
  src={resolveWorkerImageUrl({ id: item.worker_id, imageUrl: item.image_url })}
  alt={item.display_name}
  sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
>
  {item.display_name.charAt(0).toUpperCase()}
</Avatar>
```

### image_url の型
`z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).nullable()` — null を許容（`imageUrl` 未設定ワーカーに対応）。`.optional()` でなく `.nullable()` を選択したのは、レスポンスに常にフィールドが含まれる方が型安全性が高いため。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `common/src/domain/view/view.ts` | `WorkerRankingItemSchema` に `image_url` 追加 |
| `common/src/domain/view/view.test.ts` | `image_url` を含むテストケース追加 |
| `server/src/routes/workers.ts` | ranking ハンドラに `image_url: w.imageUrl ?? null` 追加 |
| `client/src/routes/WorkerRankingScene.tsx` | `RankingRow` に `Avatar` 追加 |
| `client/src/routes/WorkerRankingScene.test.tsx` | mock データに `image_url` 追加 + Avatar テスト追加 |
| `e2e/ranking/usecases.md` | UC-RANK-02 の期待動作にアバター表示を追記 |

## 6. テスト計画（TDD で書くテスト一覧）

### common
- `WorkerRankingItemSchema` が `image_url: null` をパースできる
- `WorkerRankingItemSchema` が `image_url: "https://example.com/img.png"` をパースできる
- `image_url` が 501 文字を超えると reject する

### client
- 各ランキング行に `alt="Alice"` の Avatar が表示される
- `image_url: null` のとき表示名の頭文字が Avatar 内に表示される
- 空状態（データ 0 件）の挙動は変わらない（既存テスト）

## 7. リスク・未決事項

- OpenAPI 再生成・型生成はビルドパイプラインに委ねる（生成物はコミットしない）。
- DiceBear URL は Issue #959 で Boring Avatars に差し替え予定だが、本 Issue は `resolveWorkerImageUrl` を通じて既存の URL 生成に乗るため影響を受けない。
