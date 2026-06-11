# 設計書: InvitationsTab のフォームを @tanstack/react-form に移行する (#371)

## 1. 目的 / 背景

CLAUDE.md「フォーム規約」(#262) は @tanstack/react-form の `useForm` / `form.Field` を使うことを義務付け、生 `useState` によるフォームフィールド管理を禁止している。

`client/src/components/InvitationsTab.tsx` の招待リンク発行フォームは `expiresInHours` / `memo` の 2 フィールドを生 `useState` で管理しており、規約違反の状態である。

## 2. スコープ（やること / やらないこと）

**やること**
- `InvitationsTab` の `expiresInHours` / `memo` state を `useForm` + `form.Field` に置き換え
- 送信処理を `form.handleSubmit` 経由に統一
- 発行後の `memo` クリアを `form.reset()` で実施
- RTL テストを新実装に追従させ、memo入力・有効期限選択・発行ボタン押下で mutation が正しい引数で呼ばれることを検証するテストを追加

**やらないこと**
- スナックバー開閉・作成結果表示などフォーム以外の `useState` は変更しない
- 招待リンクのドメイン仕様変更
- フォームバリデーションの追加（元の実装に無いため）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `InvitationsTab` の `expiresInHours` / `memo` が `useForm` + `form.Field` で管理され、生 `useState` のフォームフィールド管理が廃止されていること
2. 送信処理が `form.handleSubmit` 経由で動作すること
3. `memo` の `inputProps={{ maxLength: 200 }}` が維持されること
4. 発行後に `form.reset()` でフォームがクリアされること
5. RTL テスト: メモを入力して発行すると `mutateAsync` に `{ memo: "..." }` が含まれること
6. RTL テスト: メモなしで発行すると `mutateAsync` に `memo` が含まれないこと
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### useForm の構成

```ts
const form = useForm({
  defaultValues: { expiresInHours: 24, memo: "" },
  onSubmit: async ({ value }) => { ... }
})
```

### Select (MUI) の form.Field 化

`form.Field` name="expiresInHours" で MUI `Select` を包む。
`field.handleChange(Number(e.target.value))` でvalue を number に変換。

### 発行後のリセット

`form.reset()` で `expiresInHours: 24` / `memo: ""` に戻る。

### フォーム送信

`<Box component="form" onSubmit={async (e) => { e.preventDefault(); await form.handleSubmit(); }}>` でラップする（LoginScene 参照実装の踏襲）。

発行ボタンは `type="submit"` に変更し `onClick` ハンドラは削除。

## 5. 影響範囲 / 既存への変更

- `client/src/components/InvitationsTab.tsx` — 改修対象
- `client/src/components/InvitationsTab.test.tsx` — テスト追加/更新

## 6. テスト計画（TDDで書くテスト一覧）

- メモを入力して発行 → `mutateAsync` に `{ memo: "テストメモ" }` が含まれる
- メモなしで発行 → `mutateAsync` に `memo` が含まれない（または `undefined`）
- 既存テスト: 「発行」ボタン押下で createInvitation が呼ばれる → 維持
- 既存テスト: 発行後に招待 URL が表示される → 維持

## 7. リスク・未決事項

- MUI `Select` は `<input>` 要素を隠すため `findByLabelText` ではなく `findByRole("combobox")` が必要になる場合がある（既存テストは `findByLabelText(/有効期限/)` を使用）。テスト実行時に確認し、必要であれば修正する。
