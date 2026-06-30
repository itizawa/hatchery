# 設計書: アバター自動生成を DiceBear から Boring Avatars（beam スタイル）に移行する (#959)

## 1. 目的 / 背景

#884 で導入した `generateWorkerAvatarUrl` は DiceBear の `bottts-neutral`（ロボット風）スタイルを使っている。
プロダクトの世界観（観察エンタメ・Reddit 風 UI / Linear / Vercel Dashboard 風）により合う
**Boring Avatars の `beam` スタイル**（幾何学グラデーション）に移行することで、デザインの一貫性を高める。

## 2. スコープ（やること / やらないこと）

### やること

- `common/src/domain/worker/worker.ts` の `generateWorkerAvatarUrl` が返す URL を Boring Avatars beam スタイルに変更
- 廃止となる `DICEBEAR_BASE_URL` 定数の削除
- 影響を受ける全テストファイルの期待値を Boring Avatars URL に更新

### やらないこと

- Boring Avatars npm パッケージの導入（URL API で十分）
- カラーパレットの `SLACK_COLORS` への統一（別 Issue）
- `WORKER_AVATAR_URL_MAX_LENGTH` 定数の削除（将来の利用に備えて保持、#592 コメントあり）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateWorkerAvatarUrl({ id })` が `https://source.boringavatars.com/beam/40/{encodeURIComponent(id)}` を返す
2. `resolveWorkerImageUrl({ id, imageUrl: null })` が Boring Avatars URL を返す
3. `resolveWorkerImageUrl({ id, imageUrl: "https://..." })` は既存 imageUrl をそのまま返す（既存挙動維持）
4. `common/src/domain/worker/worker.test.ts` のアバター URL 関連テストが Boring Avatars URL を期待値として通過
5. `server/src/routes/authorWorker.test.ts`・`feed.test.ts`・`posts.test.ts` および `common/src/domain/worker/authorWorker.test.ts` の期待値を全て更新
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### URL 形式

```
Before: https://api.dicebear.com/9.x/bottts-neutral/svg?seed={encodeURIComponent(id)}
After:  https://source.boringavatars.com/beam/40/{encodeURIComponent(id)}
```

- サイズ: `40`（MUI Avatar デフォルトサイズ相当）
- カラーパレット: Boring Avatars デフォルト（変更不要）
- 変更は `common/` の 1 関数のみ（外部 I/F は変わらない）

### 定数の整理

- `DICEBEAR_BASE_URL` → 削除（使用箇所がなくなるため）
- `WORKER_AVATAR_URL_MAX_LENGTH` → 保持（将来用、#592）

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|----------|----------|
| `common/src/domain/worker/worker.ts` | `DICEBEAR_BASE_URL` 削除、`generateWorkerAvatarUrl` URL 変更 |
| `common/src/domain/worker/worker.test.ts` | `api.dicebear.com` → `source.boringavatars.com/beam` に更新 |
| `server/src/routes/authorWorker.test.ts` | 同上 |
| `server/src/routes/feed.test.ts` | 同上 |
| `server/src/routes/posts.test.ts` | 同上 |
| `common/src/domain/worker/authorWorker.test.ts` | 同上 |

## 6. テスト計画（TDD で書くテスト一覧）

`generateWorkerAvatarUrl` の describe ブロック:
- beam スタイル URL（`source.boringavatars.com/beam`）を返す
- URL にワーカー ID が含まれる
- 同じ ID は同じ URL を返す（決定論的）
- 異なる ID は異なる URL を返す
- 特殊文字を含む ID は URL エンコードされる

`resolveWorkerImageUrl` の describe ブロック:
- imageUrl が設定されていればそのまま返す（変更なし）
- imageUrl が null/undefined のとき Boring Avatars URL を返す

## 7. リスク・未決事項

- Boring Avatars の外部 API（`source.boringavatars.com`）への依存が増える（既存の DiceBear も同様）
- カラーパレットのデフォルト値が SLACK_COLORS と異なる可能性があるが、スコープ外として別 Issue で対応
