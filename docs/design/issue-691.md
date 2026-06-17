# 設計書: 非管理者ユーザーのサイドバーで Divider が2本連続表示されるバグを修正する (#691)

## 1. 目的 / 背景

`client/src/routes/RootLayout.tsx` の `SidebarContent` コンポーネントで、非管理者ユーザーがログインするとサイドバーに `<Divider>` が2本連続して表示されるバグがある。

現在の構造（line 94〜135 の `SidebarContent`）:
```
<SidebarGlobalNav />
<Divider />              ← 常時表示（①）
<SidebarCommunitySection />
<Divider />              ← 常時表示（②・問題の Divider）
<List dense>
  {user && isAdmin(user) && ( ...管理画面メニュー... )}
</List>
<Divider />              ← 常時表示（③・リーガルリンク前）
<List dense>利用規約/プライバシーポリシー</List>
```

非管理者（または未ログイン）のとき `<List dense>` の中身が空になるため、② と ③ の Divider が連続して表示される。

## 2. スコープ（やること / やらないこと）

- **やること**: `SidebarContent` 内の Divider ② を管理者条件レンダリングに含め、非管理者では表示しない
- **やらないこと**: サイドバー全体のリファクタリング、他コンポーネントへの影響

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 非管理者ログイン時: サイドバーの `role=separator`（Divider）が 2 本のみ（① と ③）
2. 管理者ログイン時: `role=separator` が 3 本（① と ② と ③）、管理画面メニューが ② と ③ の間に表示
3. 未ログイン時: `role=separator` が 2 本のみ（① と ③）
4. `RootLayout.test.tsx` に上記 3 ケースのテストが追加されている
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**変更箇所**: `client/src/routes/RootLayout.tsx` の `SidebarContent` コンポーネントのみ。

変更前:
```tsx
<SidebarCommunitySection />
<Divider sx={{ my: 1 }} />  {/* ← 常時表示（問題）*/}
<List dense>
  {user && isAdmin(user) && (
    <ListItem ...>管理画面</ListItem>
  )}
</List>
<Divider sx={{ my: 1 }} />  {/* ← リーガルリンク前 */}
```

変更後:
```tsx
<SidebarCommunitySection />
{user && isAdmin(user) && (
  <>
    <Divider sx={{ my: 1 }} />
    <List dense>
      <ListItem ...>管理画面</ListItem>
    </List>
  </>
)}
<Divider sx={{ my: 1 }} />  {/* ← リーガルリンク前（常時） */}
```

## 5. 影響範囲 / 既存への変更

- **変更対象ワークスペース**: `client/` のみ
- **変更ファイル**:
  - `client/src/routes/RootLayout.tsx`（`SidebarContent` コンポーネントの Divider 配置変更）
  - `client/src/routes/RootLayout.test.tsx`（新テストケース追加）
- **既存テストへの影響**: line 282 の「Divider（role=separator）が表示される」テストは `toBeGreaterThanOrEqual(1)` なので影響なし

## 6. テスト計画（TDD で書くテスト一覧）

```
describe("サイドバー Divider 重複バグ修正 (#691)", () => {
  it("非管理者ユーザーのサイドバーで Divider が2本だけ表示される")
  it("管理者ユーザーのサイドバーで Divider が3本表示される")
  it("未ログイン状態でも Divider が2本だけ表示される")
})
```

## 7. リスク・未決事項

- 特になし。変更は最小スコープ（条件レンダリングの移動のみ）で、副作用リスクが低い。
