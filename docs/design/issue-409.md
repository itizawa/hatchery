# 設計書: Post 詳細画面（PostThreadScene）のレイアウトシフトを解消する (#409)

## 1. 目的 / 背景

`/posts/$postId`（`PostThreadScene`）で 2 種類のレイアウトシフト（CLS）が発生している。

1. **ローディング表示がテキスト 1 行のみ**: `usePostThread` ローディング中は「読み込み中...」の `Typography` 1 行だけを描画しており、取得完了時にコンテンツ全体が一気に出現して大きくシフトする。スケルトンによる領域確保がない。
2. **右サイドバーの遅延出現**: 右サイドバーは `{community && ...}` の条件描画で、`usePublicCommunities()` の結果が来てから出現するため、左カラム（`flex: 1`）の幅が縮んでリフローが起きる。

## 2. スコープ（やること / やらないこと）

**やること**:
- `usePostThread` ローディング中: 2 カラム構造を維持したまま MUI `Skeleton` でプレースホルダを描画（テキスト「読み込み中...」の廃止）
- 右サイドバー列: `usePublicCommunities` ローディング中も 312px 幅を確保し、中身を Skeleton で埋める

**やらないこと**:
- `CommunityScene.tsx` の同種のレイアウトシフト対応（別 Issue）
- `community` が見つからない場合のサイドバー非表示の変更（現状維持）
- サーバ API の変更（post レスポンスに community を含める等）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `usePostThread.isLoading=true` のとき、`data-testid="post-thread-skeleton"` を持つ 2 カラムスケルトンが描画される。テキスト「読み込み中...」は描画されない。
2. `usePostThread.isLoading=false` かつ `usePublicCommunities.isLoading=true` のとき、右サイドバー領域（312px）に `data-testid="community-sidebar-skeleton"` を持つ Skeleton が描画され、コミュニティ名は表示されない。
3. `usePublicCommunities.isLoading=false` かつ community が見つかった場合: 右サイドバーに CommunitySidebarCard が表示される（既存挙動維持）。
4. `usePublicCommunities.isLoading=false` かつ community が見つからない場合: サイドバー非表示（既存挙動維持）。
5. 既存テスト（#380 / #390）が全て緑のまま。
6. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ローディングスケルトン（`usePostThread.isLoading=true`）

早期リターン分岐を変更し、2 カラム構造のスケルトンを返す。

```
<Box data-testid="post-thread-skeleton" sx={{ p:3, maxWidth:1200, mx:"auto" }}>
  <Box sx={{ display:"flex", gap:3 }}>
    <Box sx={{ flex:1 }}>        // 左カラム
      <Skeleton variant="rectangular" height={200} />
      <Skeleton variant="text" /> × 3
    </Box>
    <Box sx={{ width:312, display:{xs:"none", md:"block"} }}> // 右カラム
      <Skeleton variant="rectangular" height={300} />
    </Box>
  </Box>
</Box>
```

### 右サイドバーのロード中幅確保（`usePublicCommunities.isLoading=true`）

`usePublicCommunities` から `isLoading` を取得する。

条件: `isCommunitiesLoading || Boolean(community)` のとき右カラム Box を描画。
内側の条件分岐:
- `isCommunitiesLoading=true` → `<Skeleton data-testid="community-sidebar-skeleton" />`
- `community` 存在 → `<CommunitySidebarCard ...>`
- どちらでもなく描画される（`isCommunitiesLoading=false && !community`）→ `null`（Box は描画されるが中身 null。ただし外側条件で除外）

実際には外側 `isCommunitiesLoading || Boolean(community)` で Box を描画するかどうかを決めるため、community が見つからない場合の「サイドバー非表示」は維持できる。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- `client/src/routes/PostThreadScene.tsx`: ローディング状態・サイドバー条件分岐を変更
- `client/src/routes/PostThreadScene.test.tsx`: 既存テスト更新 + 新規テスト追加

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | 期待 |
|--------|------|
| ① `usePostThread` ローディング中: スケルトンが描画される | `screen.getByTestId("post-thread-skeleton")` を検出 |
| ② ロード完了後: コンテンツが表示される | 既存テスト `findByText("今日も元気に始めましょう")` 維持 |
| ③ communities ロード中: サイドバースケルトンが描画される | `screen.getByTestId("community-sidebar-skeleton")` を検出 |
| ④ 既存テスト（#380 / #390）: 全て緑のまま | 既存テストが壊れていないこと |

## 7. リスク・未決事項

- `delay("infinite")` を使うテストはリクエストキャンセル時に `act()` 警告が出る可能性がある。`afterEach` の `server.resetHandlers()` でクリーンアップされるため問題ないが、警告が出る場合はテスト設計を見直す。
- 右サイドバーの Skeleton は `staleTime` の境界で `isLoading` が `false` になるケースがある（キャッシュ有効時）。初回ロード後は communities がキャッシュされるため恒常的な問題にならない。
