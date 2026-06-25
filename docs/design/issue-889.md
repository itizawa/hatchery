# 設計書: コミュニティ作成・編集をモーダルから専用ページに移行し画像アップロードを統合する (#889)

## 1. 目的 / 背景

現在の `AddCommunityDialog` / `EditCommunityDialog` はモーダルで動作しており、フィールドが多くなると縦長で操作性が悪い。また `CommunitiesTab.tsx` では `{dialogOpen && <EditCommunityDialog ...>}` の条件付きマウントで毎回 `useForm` を再初期化する回避策を取っている。

#888（ワーカー作成・編集ページ化）と同パターンで、コミュニティ作成・編集を専用ページに移行し、操作フローを改善する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `/admin/communities/new` — コミュニティ作成ページ (`AddCommunityScene`)
- `/admin/communities/:id/edit` — コミュニティ編集ページ (`EditCommunityScene`)
- `CommunitiesTab` の「コミュニティを追加」ボタンを `/admin/communities/new` へのナビゲーションに変更
- `CommunitiesTab` の「編集」ボタンを `/admin/communities/:id/edit` へのナビゲーションに変更
- `AddCommunityDialog` / `EditCommunityDialog` の廃止（ファイル削除）
- `router.tsx` への 2 ルート追加

**やらないこと:**
- slug 変更 API の追加
- コミュニティ削除機能
- 単体コミュニティ取得 API の追加（既存の一覧 API + selector で対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `/admin/communities/new` へのルートが存在し、`requireAdminRoute` ガードが効く
2. `AddCommunityScene` が slug / name / description / generationInstruction フィールドを表示する
3. `AddCommunityScene` の送信成功後に `/admin/communities/:id/edit` へ遷移する
4. `/admin/communities/:id/edit` へのルートが存在し、`requireAdminRoute` ガードが効く
5. `EditCommunityScene` が name / description / generationInstruction フィールドと CommunityImageUpload を表示する
6. `EditCommunityScene` で存在しない ID を指定した場合「コミュニティが見つかりません」と表示する
7. `CommunitiesTab` の「コミュニティを追加」ボタンが `/admin/communities/new` へのリンクになる
8. `CommunitiesTab` の「編集」ボタンが `/admin/communities/:id/edit` へのリンクになる
9. `AddCommunityDialog` / `EditCommunityDialog` が廃止される（ファイルが存在しない）
10. `{dialogOpen && <EditCommunityDialog>}` の条件付きマウント回避策が不要になる
11. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 新規ファイル

- `client/src/routes/AddCommunityScene.tsx` — 作成ページ本体
- `client/src/routes/AddCommunityScene.test.tsx` — RTL テスト
- `client/src/routes/EditCommunityScene.tsx` — 編集ページ本体
- `client/src/routes/EditCommunityScene.test.tsx` — RTL テスト

### `useAdminCommunityById` フック追加（`communities.ts`）

```ts
export function useAdminCommunityById(id: string) {
  return useSuspenseQuery({
    queryKey: ADMIN_COMMUNITIES_QUERY_KEY,
    queryFn: fetchAdminCommunities,
    select: (list) => {
      const found = list.find((c) => c.id === id);
      if (!found) throw new Error("CommunityNotFound");
      return found;
    },
  });
}
```

`QueryBoundary` の `errorFallback` で「コミュニティが見つかりません」を表示する。

### `AddCommunityScene` 設計

- `useForm` で slug / name / description / generationInstruction を管理
- 送信成功後 `navigate` で `/admin/communities/:id/edit` へ遷移
- slug は一覧へ戻るリンクを除いて編集ページと同じレイアウト

### `EditCommunityScene` 設計

- `useParams` で `:id` を取得
- `QueryBoundary` で `EditCommunityForm` を wrap し not found を捌く
- `EditCommunityForm` 内で `useAdminCommunityById(id)` で community を取得
- `useForm` で defaultValues を community から初期化
- `CommunityFormFields` を継続利用
- `CommunityImageUpload` (cover / icon) を同一ページに統合

### `CommunitiesTab` 変更

- `addOpen` / `createdSnackbarOpen` / `dialogOpen` の状態管理を削除
- 「コミュニティを追加」ボタン → `<Link to="/admin/communities/new">` のラップに変更
- 「編集」ボタン → `<RouterLink to="/admin/communities/:id/edit" params={{ id: community.id }}>` に変更
- `AddCommunityDialog` / `EditCommunityDialog` の import を削除

### `router.tsx` 変更

```ts
const LazyAddCommunityScene = lazyRouteComponent(...)
const LazyEditCommunityScene = lazyRouteComponent(...)

const adminCommunityNewRoute = createRoute({ path: "/admin/communities/new", beforeLoad: requireAdminRoute, ... })
const adminCommunityEditRoute = createRoute({ path: "/admin/communities/$id/edit", beforeLoad: requireAdminRoute, ... })
```

## 5. 影響範囲 / 既存への変更

- **client**: `router.tsx`, `components/CommunitiesTab.tsx`, `api/communities.ts`（フック追加）
- **削除**: `components/AddCommunityDialog.tsx`, `components/AddCommunityDialog.test.tsx`, `components/EditCommunityDialog.tsx`, `components/EditCommunityDialog.test.tsx`
- **server / common**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

### `AddCommunityScene.test.tsx`

- ページタイトル「コミュニティを追加」が表示される
- slug / name / description / generationInstruction の入力欄が表示される
- 一覧に戻るリンクが表示される
- 送信すると createCommunity API が呼ばれる
- 送信成功後に編集ページへ遷移する
- slug の maxLength が COMMUNITY_SLUG_MAX_LENGTH と一致する

### `EditCommunityScene.test.tsx`

- ページタイトル「コミュニティを編集」が表示される
- name / description / generationInstruction の入力欄が表示される（既存値で初期化）
- 存在しない ID のときは「コミュニティが見つかりません」が表示される
- CommunityImageUpload が表示される
- 送信すると updateCommunity API が呼ばれる
- 一覧に戻るリンクが表示される

### `CommunitiesTab.test.tsx`（更新）

- 「コミュニティを追加」ボタンが `/admin/communities/new` へのリンクになる
- 「編集」ボタンが `/admin/communities/:id/edit` へのリンクになる
- ダイアログは表示されない（削除）

## 7. リスク・未決事項

- `useAdminCommunityById` の select で例外を throw する場合、`useSuspenseQuery` のエラー境界が拾う。`QueryBoundary` の `errorFallback` がこれを捉えて「コミュニティが見つかりません」を表示できるか確認要（TDD で検証）。
- 編集ページで community list の再フェッチが走るとフォームの defaultValues が古くなりうるが、`useSuspenseQuery` のキャッシュが stale になるまでは再フェッチしないため実用上問題なし。
