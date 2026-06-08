# Issue #262 設計書: フォームは @tanstack/react-form を必須とする規約を CLAUDE.md に追加し、自前 isDirty 実装を廃止する

## 背景

- PR #261 で `client/src/utils/formDirty.ts`（`isShallowDirty`）が追加されたが、develop ブランチには未マージ（ファイルが存在しない）。
- `@tanstack/react-form` はすでに `client/package.json` に追加済みで、`LoginScene.tsx` と `AcceptInvitationScene.tsx` で実際に使用されている。
- `AccountScene.tsx` は依然として `useState` によるフォーム自前管理をしている（Issue #187 で移行予定）。
- フォーム実装が画面ごとに不揃いなまま積み重なると一貫性が失われる。

## 目的

CLAUDE.md にフォーム規約を追加し、今後の実装・レビューで TanStack Form 以外のフォーム状態管理が混入しないようにする。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` | フォーム規約セクションを追加 |
| `client/src/utils/formDirty.ts` | 削除（develop ブランチでは既に存在しない） |
| `client/src/utils/formDirty.test.ts` | 削除（develop ブランチでは既に存在しない） |

## 設計判断

### formDirty.ts の現状

PR #261 は develop ブランチへマージされていないため、`formDirty.ts` と `formDirty.test.ts` は develop ブランチには存在しない。削除作業は不要。

### AccountScene.tsx の現状

Issue #187（AccountScene の TanStack Form 移行）が未完了のため、AccountScene.tsx は依然として `useState` を使っている。
Issue #262 の受け入れ条件 5 には「`AccountScene.tsx` が `isShallowDirty` を参照していないこと」とあるが、`isShallowDirty` の参照は元々存在しないため、この条件は既に満たされている。

### CLAUDE.md への追記内容

フォームの状態管理は `@tanstack/react-form`（`useForm` / `form.Field`）を使う規約を「フォーム規約」セクションとして追加する。以下を明記する：

1. フォームの状態管理は `@tanstack/react-form` の `useForm` / `form.Field` を使う
2. `useState` によるフォームフィールドの自前管理・自前 `isDirty` 実装は禁止
3. 参照実装は `client/src/routes/LoginScene.tsx`
4. 違反はレビューで指摘対象とする

## テスト方針

この Issue は設定ファイルの変更（CLAUDE.md）が主目的。TDD の観点では：

- `pnpm turbo run build` / `pnpm turbo run test` / `pnpm turbo run lint` が全て緑であることを確認する
- CLAUDE.md の内容に対するテストは `tests/` ディレクトリの規約テストで確認できる場合のみ追加する

## 実装手順

1. CLAUDE.md にフォーム規約セクションを追加
2. formDirty 関連ファイルが存在しないことを確認（確認済み）
3. 全テスト・lint・ビルドを確認
