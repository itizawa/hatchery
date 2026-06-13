# 設計書: Issue #420 未使用の自前 isDirty 実装 `client/src/utils/formDirty.ts` を削除する（#262 後処理）

## 背景

`client/src/utils/formDirty.ts` の `isShallowDirty` は、#262「フォームは `@tanstack/react-form` を必須とし、自前 isDirty 実装を廃止する」以前の自前ダーティ検知ヘルパ。現在は参照箇所がゼロのデッドコードであり、テスト `formDirty.test.ts` のみが残存している。CLAUDE.md「フォーム規約」は自前 isDirty 実装を禁止しているため、このヘルパが残っていると将来のコードが誤って再利用する温床になる。

## 目的

#262 の後処理として自前 isDirty 実装（`isShallowDirty`）を完全撤去し、フォーム規約の唯一の手段が `useForm`（`form.state.isDirty` 等）であることをコードベース上でも担保する。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 検証方法 |
|---|--------------|----------|
| 1 | `client/src/utils/formDirty.ts` と `client/src/utils/formDirty.test.ts` が削除されている | `git status` / ファイル不在 |
| 2 | `isShallowDirty` への参照が client 全体に存在しない（grep ゼロ件） | `grep -rn 'formDirty\|isShallowDirty' client/src` → 0 件 |
| 3 | `pnpm turbo run build test lint` が緑 | ローカル実行 + CI |

## 設計判断

- **純粋なデッドコード削除**であり、削除対象の 2 ファイル以外に `isShallowDirty` / `formDirty` への参照が存在しないことを事前に grep で確認済み（develop HEAD で 0 件）。barrel/index ファイルからの再エクスポートも無し。
- ユーザーに見える振る舞いは一切変わらない（純リファクタ）ため、`e2e/` ユースケースの更新は不要。
- TDD の「テスト削除」の扱い: 本タスクは「テストごと撤去するデッドコード削除」であり、新規ロジックを追加しない。したがって新規テストは追加せず、削除後に既存スイート全体（`build test lint`）が緑であることをもって回帰が無いことを担保する。`formDirty.test.ts` は削除対象そのものなので、削除によりテストが減るのは仕様どおり。
- `import` 境界（client→common の一方向）には影響しない（client 内ファイルの削除のみ）。

## 影響範囲

- 削除: `client/src/utils/formDirty.ts`, `client/src/utils/formDirty.test.ts`
- それ以外のファイル変更なし。
