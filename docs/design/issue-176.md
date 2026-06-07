# 設計書: サイドバー下部のユーザー操作（アカウント設定・ログアウト）を Menu に集約する (#176)

## 1. 目的 / 背景

現状の `UserFooter.tsx` ではアカウント設定リンクとログアウトボタンが常時表示されており、Slack 風 UI の「ユーザー名クリックでメニューが開く」一般的な振る舞いと乖離している。これらを MUI Menu に集約し、フッターを「Avatar + 表示名（クリック可能）」だけに整理する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/components/UserFooter.tsx` を改修し、MUI `Menu`/`MenuItem` を使ったユーザーメニューに変更する
- 「アカウント設定」「ログアウト」を Menu の MenuItem として実装する
- `UserFooter.test.tsx` を更新して Menu を通じた操作テストに対応する

**やらないこと:**
- `client/src/api/auth.ts` の変更（ログアウト API はそのまま）
- `/account` ルート定義の変更
- Menu 項目の追加（テーマ切替・通知設定など）
- `AccountScene` 自体の改修

## 3. 受け入れ条件（テストに落とせる粒度）

1. 初期表示時に「アカウント設定」「ログアウト」が DOM 上に表示されていない（Menu は閉じている）
2. トリガー要素（Avatar/表示名を含むボタン）が表示されている
3. トリガーをクリックすると Menu が開き「アカウント設定」「ログアウト」の MenuItem が表示される
4. 「アカウント設定」をクリックすると `/account` へ遷移し、Menu が閉じる
5. 「ログアウト」をクリックすると `useLogout` の mutation が走り、成功時に `/login` へ遷移し、Menu が閉じる
6. トリガーは適切な `aria-label`（例: "ユーザーメニュー"）を持つ
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### コンポーネント構造

```tsx
// anchorEl を useState で保持（null = 閉じている）
const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
const open = Boolean(anchorEl);

// トリガー: ButtonBase（Avatar + 表示名）
<ButtonBase onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="ユーザーメニュー" ...>
  <Avatar ...>{initial}</Avatar>
  <Typography ...>{user.displayName}</Typography>
</ButtonBase>

// MUI Menu
<Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
  <MenuItem component={RouterLink} to="/account" onClick={() => setAnchorEl(null)}>
    アカウント設定
  </MenuItem>
  <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }}>
    ログアウト
  </MenuItem>
</Menu>
```

### uiParts への追加

`Menu` と `ButtonBase` は既存の `uiParts/index.ts` に追加する（`MenuItem` は既存あり）。

## 5. 影響範囲

- 対象ワークスペース: **client のみ**
- 変更ファイル:
  - `client/src/components/uiParts/index.ts` — `Menu`, `ButtonBase` を追加
  - `client/src/components/UserFooter.tsx` — Menu パターンに改修
  - `client/src/components/UserFooter.test.tsx` — テスト更新（Menu クリック動作を検証）

## 6. テスト計画（TDD で書くテスト一覧）

1. 初期表示時「アカウント設定」が DOM に存在しない
2. 初期表示時「ログアウト」ボタンが DOM に存在しない
3. トリガーボタン（aria-label="ユーザーメニュー"）が表示される
4. トリガークリック後に「アカウント設定」MenuItem が表示される
5. トリガークリック後に「ログアウト」MenuItem が表示される
6. 「ログアウト」クリックで `/auth/logout` への POST が発火し `/login` へ遷移する
7. 「アカウント設定」クリックで `/account` へ遷移する
8. 未ログイン時は何も表示されない（既存テスト継続）

## 7. リスク・未決事項

- MUI の `Menu` ポータル（`Portal`）は jsdom 環境でも `screen.findByRole` で取得可能（MUI v6 標準動作）。
- `ButtonBase` は MUI の基底ボタン要素で、`role="button"` を持つ。aria-label を付与すれば RTL で取得可能。
