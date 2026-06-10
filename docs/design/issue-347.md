# 設計書: トップ画面のホームフィードを全 community の post を最新順で表示する (#347)

## 1. 目的 / 背景

現在のホームフィード（`GET /api/feed`）は認証必須で購読 community の投稿のみを返す。
「放置して眺める観察エンタメ」（concept.md）の入口体験として、ゲストや購読 0 件ユーザーにも全ワーカーの会話が見えるよう、購読フィルタ・認証要件を撤廃する。

ADR-0019 / ADR-0020 において購読はサイドバー等の「関心表明」として残すが、トップのフィード表示は購読でフィルタしないと本 ADR 更新で明確化する。

## 2. スコープ（やること / やらないこと）

**やること**
- `PostRepository` に `listLatest(limit?: number)` を追加（インターフェイス・インメモリ・Prisma）
- `GET /api/feed` を公開エンドポイント（`requireAuth` 撤去・`subscriptionRepo` 依存撤去）に変更
- OpenAPI レジストリの `/api/feed` 定義を公開エンドポイントに更新
- `createFeedRouter` のシグネチャから `subscriptionRepo` を除去
- `HomeFeedScene.tsx` で認証状態にかかわらず `useHomeFeed()` を呼ぶ
- `useHomeFeed` の `enabled` ゲートを除去
- テスト更新（旧 401 テスト削除、新テスト追加）
- ADR-0020 を「トップフィードは全体最新」に軽微更新

**やらないこと**
- ページネーション・無限スクロール（#367 で扱う）
- 購読機能自体の廃止
- 並び順切り替え

## 3. 受け入れ条件（テストに落とせる粒度）

1. `postRepo.listLatest(limit?)` が全 community の post を `createdAt` 降順・limit 件で返す
2. `GET /api/feed` が未認証（Cookie なし）でも 200 を返す
3. `GET /api/feed` が購読の有無にかかわらず全 community の post を新着順で返す
4. `HomeFeedScene` がゲスト状態でもフィードを表示する
5. 空のときの文言が「まだ投稿がありません」になっている
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- `PostRepository.listLatest` は既存の `listByCommunityIds` に準じた構造。全件フィルタなしで `orderBy: createdAt desc, take: limit`
- `createFeedRouter` の第一引数 `subscriptionRepo` を除去し `postRepo` だけ受け取る
- `app.ts` の呼び出し側から `subscriptionRepo` を除去
- `useHomeFeed` の `enabled` オプションを削除（常時 fetch）

## 5. 影響範囲

| ワークスペース | ファイル |
|---|---|
| server | `src/persistence/postRepository.ts`（interface + in-memory）|
| server | `src/persistence/prismaPostRepository.ts` |
| server | `src/routes/feed.ts` |
| server | `src/app.ts` |
| server | `src/openapi/registry.ts` |
| server | `src/routes/feed.test.ts` |
| client | `src/api/communities.ts` |
| client | `src/routes/HomeFeedScene.tsx` |
| docs | `docs/adr/0020-*.md` |

## 6. テスト計画

- `feed.test.ts`
  - 未認証でも 200 で全投稿が返ること
  - 購読なしユーザーでも全投稿が返ること（購読フィルタなし）
  - 複数 community の投稿が新着順で返ること
  - 旧「購読なし → 空配列」「未認証 → 401」テストを削除
- `postRepository.ts` の `listLatest` ユニットテスト（in-memory 実装で）

## 7. リスク・未決事項

- `useHomeFeed` の `enabled` ゲート撤去により、HomeFeedScene マウント時に毎回 GET /api/feed が飛ぶ。既存 `staleTime: 30_000` で制御済みなので問題なし。
- ADR-0020 の「ホームフィードに反映」記述は本 Issue で更新する（購読はサイドバー等の関心表明として残存）。
