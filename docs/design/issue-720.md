# 設計書: ESLint max-params を 1 に設定し、関数引数を全て名前付き（オブジェクト引数）に統一する (#720)

## 1. 目的 / 背景

関数の位置引数（positional arguments）では、同じ型の引数が複数並ぶケースで引数順序を誤っても TypeScript の型検査で検知できない。
ESLint の `max-params: 1` ルールを全ワークスペースに適用し、引数が 2 個以上の関数定義をエラーとすることで、全ての多引数関数をオブジェクト引数（名前付き引数）に統一する。

## 2. スコープ（やること / やらないこと）

### やること
- `eslint.config.mjs` のグローバルルールに `"max-params": ["error", { "max": 1 }]` を追加
- 全ワークスペース（common / server / client / docs）の既存違反を修正（オブジェクト引数化 or `eslint-disable`）
- `CLAUDE.md` に新規コーディング規約を追記

### やらないこと
- 自動生成ファイル（`*.gen.ts`, `dist/`）の修正（lint 対象外）
- 外部ライブラリの型定義変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `eslint.config.mjs` のグローバルルールに `"max-params": ["error", { "max": 1 }]` が追加されている
2. Express ミドルウェア・配列コールバック等、外部 I/F 都合で位置引数が避けられないパターンは `eslint-disable-next-line` または `eslint-disable` コメントで適切に例外処理されている
3. `pnpm lint`（`turbo run lint`）が全ワークスペースで緑になる
4. `CLAUDE.md` に「関数引数は必ずオブジェクト引数（名前付き引数）を使う。ESLint `max-params: 1` で強制」旨の規約が追記されている
5. `pnpm turbo run build test lint` が全て緑になる

## 4. 設計方針

### 修正優先度
1. **オブジェクト引数化優先**: `({ a, b }: { a: T; b: U })` の形に変換
2. **書き換え不可のケースのみ `eslint-disable`**: Express ミドルウェア `(req, res, next)`、配列コールバック `(item, index)` 等

### 例外パターン（`eslint-disable` 対象）
- Express ミドルウェア: `(req: Request, res: Response, next?: NextFunction)`
- Express エラーハンドラー: `(err: Error, req: Request, res: Response, next: NextFunction)`
- 配列コールバック: `Array.prototype.reduce`, `sort`, `findIndex` 等で index/accumulator が必要なもの
- Prisma `$transaction` コールバック: `(prisma, options)` 等
- テストコールバック（vitest/describe/it）

### ルール設定
```js
"max-params": ["error", { "max": 1 }]
```
グローバルルールのブロックに追加。特定ファイルの `overrides` より、違反箇所をオブジェクト引数化する方針を優先する。

## 5. 影響範囲 / 既存への変更

- **`eslint.config.mjs`**: グローバルルール追加
- **`CLAUDE.md`**: コーディング規約追記
- **`common/`・`server/`・`client/`・`docs/`**: 違反箇所をオブジェクト引数化 or `eslint-disable` コメント追加

## 6. テスト計画（TDDで書くテスト一覧）

TDD 対象は "ESLint ルールが有効化されている" こと。
- `eslint.config.mjs` に `max-params: 1` が設定された状態でルールを有効化（red: 違反あり）
- 全違反を修正して `pnpm lint` が緑になる（green）

## 7. リスク・未決事項

- 違反数が多い場合、修正量が大きくなる可能性がある（lint 実行後に確認）
- Prisma の `$transaction` コールバックや vitest の `describe/test` 等は書き換え不可のため `eslint-disable` が必要
