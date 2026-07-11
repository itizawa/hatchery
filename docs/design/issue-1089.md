# 設計書: コミュニティ管理者が重要な投稿をピン留めしフィード上部に固定表示できるようにする (#1089)

## 1. 目的 / 背景

hatchery コミュニティ（メタコミュニティ）で「重要な投稿やコメントをピン留めする機能、なくない？」という指摘があり、`common`・`server` を調査した結果 Post に pin 状態を表すフィールドが一切存在しないことを確認した。community 管理者（admin）が特定の post をピン留めし、community フィードの最上部に固定表示できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**

- Post に `is_pinned` / `pinned_at` を追加する。
- admin が post を pin / unpin する API（1 community あたり最大 3 件まで）。
- `GET /api/communities/:slug/feed` で、pin された post を新着順・人気順に関わらず先頭に表示する。
- community フィード画面（`CommunityScene.tsx`）で、admin ユーザーには pin / unpin ボタンを表示し、pin 済み post には「固定」ラベルを表示する。

**やらないこと（スコープ外）**

- コメント単位のピン留め（Issue 本文で明記）。
- pin する post の自動選定（vote スコア等による自動昇格）。
- pin 理由等の自由入力フィールド（既存コードに前例がなく、要求も「持たせる場合は」という条件付きのため、今回は追加しない。`is_pinned` + `pinned_at` のみのミニマル実装とする）。
- ホームフィード（`GET /api/feed`）への pin 反映（community をまたぐため対象外。community フィードのみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PostSchema`（common）に `is_pinned: boolean`（デフォルト `false`）・`pinned_at: Date | null`（省略可）を追加する。
2. `POST /api/admin/posts/:id/pin`（admin 限定）で post を pin できる。community あたり pin 済みが既に `POST_PIN_MAX_COUNT`（3）件ある場合は 409 を返す。存在しない post は 404。
3. `DELETE /api/admin/posts/:id/pin`（admin 限定）で pin を解除できる。存在しない post は 404。未 pin の post に対しても冪等に 200 を返す。
4. `GET /api/communities/:slug/feed` の **1 ページ目（`cursor` 未指定時）にのみ** pin 済み post を `pinned_at` 降順で先頭に表示し、以降は通常の並び順（`sort=latest`/`popular`）で表示する。pin された post は通常の並び順の枠内では重複して表示されない（2 ページ目以降にも出現しない）。
5. pin 済み post が 0 件の community では従来どおりの表示（先頭に何も追加されない）。
6. member / 未認証ユーザーは pin / unpin API を呼べない（401 / 403）。
7. client の community フィード画面で、admin ユーザーには各 post に pin / unpin ボタンが表示され、pin 済み post には「固定」ラベルが表示される。admin 以外のユーザーには pin / unpin ボタンは表示されない。
8. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### データモデル

- `Post` テーブルに `isPinned Boolean @default(false)` / `pinnedAt DateTime?` を追加。
- 上限（`POST_PIN_MAX_COUNT = 3`）は書き込み時（pin API）にのみ強制する。読み取り側は「pin 済みは `pinned_at` 降順で先頭に出す」だけのシンプルなロジックにする。

### API

- 新規: `POST /api/admin/posts/:id/pin`（`requireAdminAccess`・body なし）。community 内の pin 済み件数（`countPinnedByCommunity`）が `POST_PIN_MAX_COUNT` 以上なら `ConflictError`（409）。
- 新規: `DELETE /api/admin/posts/:id/pin`（`requireAdminAccess`・冪等）。
- 既存 `GET /api/communities/:slug/feed` を変更: pin 済み post 一覧（`listPinnedByCommunity`）を取得し、通常のページ取得（`listByCommunityPaged` / `listByCommunityPopularPaged`）には pin 済み post の id を `excludePostIds` として渡して重複を防ぐ。`cursor` が未指定（1 ページ目）のときだけ pin 済み post を先頭に連結する。

pin 済み post を「常に 1 ページ目にのみ表示・以降のページには出さない」という設計にしたのは、cursor ベースのページネーションと相性が良く（pin の有無がページサイズや cursor の意味を変えない）、Reddit 等の一般的な pinned post UX（フィード上部に固定表示、下にスクロールすれば通常の投稿が続く）とも整合するため。

### 永続化層（`PostRepository`）

- `PostRecord` に `isPinned: boolean` / `pinnedAt: Date | null` を追加。
- 新規メソッド:
  - `pinPost({ id, pinnedAt }): Promise<PostRecord | null>`
  - `unpinPost(id): Promise<PostRecord | null>`
  - `countPinnedByCommunity(communityId): Promise<number>`
  - `listPinnedByCommunity(communityId): Promise<PostRecord[]>`（`pinnedAt` 降順）
- 既存 `listByCommunityPaged` / `listByCommunityPopularPaged` に任意引数 `excludePostIds?: string[]` を追加し、指定された id を結果から除外する（in-memory はフィルタ、Prisma は `id: { notIn: excludePostIds } }`）。

### client

- `client/src/api/posts.ts` に `pinPost` / `unpinPost` と `usePinPost` / `useUnpinPost`（community フィードのキャッシュ [`communityFeedQueryKeyPrefix`] を invalidate）を追加。
- `PostCard` に `isPinned?: boolean` を追加し、既存の `isNew` Chip と同じ並びに「固定」Chip を表示する（色は `isNew` の blue と被らないよう `default`/outlined にする）。
- pin / unpin ボタンは `CommunityScene.tsx` 側で `isAdmin(authUser)` のときのみ表示する（既存の `isAdmin` パターンを踏襲。専用の admin 管理画面は post 単位の操作に対応する前例がないため、community フィード上のインライン操作として実装する）。

## 5. 影響範囲 / 既存への変更

- **common**: `common/src/domain/post/post.ts`（`PostSchema` 拡張・`POST_PIN_MAX_COUNT` 追加）
- **server**: `prisma/schema.prisma`・新規 migration、`persistence/postRepository.ts`・`persistence/prismaPostRepository.ts`、`routes/admin.ts`（pin/unpin エンドポイント）、`routes/communities.ts`（feed 統合）、`routes/postResponse.ts`（`is_pinned`/`pinned_at` マッピング）、`openapi/registrations/registerCommunities.ts`（OpenAPI 登録）
- **client**: `api/posts.ts`、`components/PostCard.tsx`、`routes/CommunityScene.tsx`
- **docs**: 本設計書、`e2e/community/usecases.md`・`e2e/usecases.md`

## 6. テスト計画（TDD で書くテスト一覧）

- common: `PostSchema` の `is_pinned` デフォルト `false`・`pinned_at` 省略可のテスト。
- server persistence: `pinPost` / `unpinPost` / `countPinnedByCommunity` / `listPinnedByCommunity` の単体テスト（in-memory）。`listByCommunityPaged` / `listByCommunityPopularPaged` の `excludePostIds` 動作テスト。
- server routes（admin）: pin/unpin の 401/403/404/409/200 系統テスト。
- server routes（communities feed）: pin 済み post が 1 ページ目の先頭に出ること・2 ページ目には出ないこと・sort=popular でも同様であること・pin 0 件時は従来どおりであること。
- client: `PostCard` の「固定」Chip 表示テスト。

## 7. リスク・未決事項

- pin 済み post を「1 ページ目にのみ表示」する設計は、ユーザーが 2 ページ目以降をスクロールしている間は pin post が見えなくなる（Reddit 等の一般的な UX と同様のため許容）。
- pin 理由フィールドは今回追加しない（Issue 本文でも条件付きの言及のみで、既存コードに前例が無いため）。将来必要になれば `.max()` 付きの別 Issue で追加する。
