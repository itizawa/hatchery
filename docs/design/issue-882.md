# 設計書: ゲストが購読ボタンを押したときログイン誘導する (#882)

## 1. 目的 / 背景

`CommunityScene.tsx` では購読ボタンを `{authUser && <SubscribeButton />}` で囲っており、ゲストには購読ボタン自体が描画されない。コミュニティに興味を持ったゲストが「どうすれば購読できるか」を知る手がかりがなく、購読 → フィード育成という観察エンタメの核心への導線が断たれていた。

vote ボタンはゲスト向けにも sessionId（guestId）で動作するが、subscription はログイン必須のため、ゲストがボタンをクリックしたときにログインモーダルへ誘導する UX が必要。

## 2. スコープ（やること / やらないこと）

**やること**
- `CommunityScene.tsx` の `CommunityHeader` `actions` に、ゲスト向けの「ログインして購読」ボタンを追加する
- ボタンクリック時、`useLoginModal().openLogin()` を呼び `?login=1` でログインモーダルへ誘導する

**やらないこと**
- `CommunitySidebarCard` のゲスト向け変更（スコープ外）
- `PostThreadScene` のサイドバー変更（スコープ外）
- ログイン後の自動購読（将来拡張）

## 3. 受け入れ条件（テストに落とせる粒度）

1. AUTH_ME_QUERY_KEY が null（ゲスト）のとき、「ログインして購読」ボタンが `CommunityHeader` actions に表示される
2. ゲストが「ログインして購読」ボタンをクリックすると `navigate({ to: ".", search: fn })` が呼ばれ、`login: 1` が付与される
3. 認証済みユーザー（AUTH_ME_QUERY_KEY に user あり）のとき、「購読する」または「購読解除」ボタンが表示される（既存 SubscribeButton の動作は変わらない）
4. 「ログインして購読」ボタンはゲストのとき `<CommunityHeader>` の `actions` に描画される
5. `pnpm turbo run build test lint` 緑

## 4. 設計方針

### アーキテクチャ

- `CommunityContent` コンポーネントに `useLoginModal` フックを追加し、`openLogin` を取得する
- `actions` 部分のロジック:
  ```tsx
  actions={
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <ShareButton ... />
      {authUser ? (
        <SubscribeButton ... />
      ) : (
        <Button variant="contained" size="small" onClick={openLogin}>
          ログインして購読
        </Button>
      )}
    </Stack>
  }
  ```
- `useLoginModal` は `useNavigate` / `useSearch`（@tanstack/react-router）を使うため、テストではこれらをモック対象に追加する

### テスト対象

- `CommunityScene.test.tsx` に新規テストケースを追加する
- ゲストケース: AUTH_ME_QUERY_KEY = null（既存のデフォルト状態を流用）
- ログイン済みケース: AUTH_ME_QUERY_KEY に mockUser をセット
- `useNavigate` / `useSearch` をモックに追加する

## 5. 影響範囲

| ワークスペース | 変更ファイル | 内容 |
|---|---|---|
| client | `src/routes/CommunityScene.tsx` | useLoginModal 追加・actions 条件分岐 |
| client | `src/routes/CommunityScene.test.tsx` | ゲスト誘導テスト追加・router mock 拡張 |

## 6. テスト計画（TDD）

1. ゲストのとき「ログインして購読」ボタンが表示される（`findByRole("button", { name: /ログインして購読/ })`）
2. ゲストがボタンをクリックすると `navigate` が `login: 1` を含む search で呼ばれる
3. 認証済みのとき「ログインして購読」ボタンが表示されない（`queryByRole("button", { name: /ログインして購読/ })` が null）
4. 認証済みのとき「購読する」ボタンが表示される

## 7. リスク・未決事項

- `useNavigate` / `useSearch` のモックを CommunityScene.test.tsx の既存 `vi.mock("@tanstack/react-router")` に追加することで、他のテストケースへの副作用を確認する必要がある（`useNavigate` は既存テストで使われていないため影響は低いと判断）
