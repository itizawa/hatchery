# 設計書: AccountScene.tsx の isDirty 判定を @tanstack/react-form の !state.isDefaultValue に置き換える (#900)

## 1. 目的 / 背景

`client/src/routes/AccountScene.tsx` の保存ボタン disabled 制御で `savedValuesRef` を使った手動 isDirty 計算をしており、CLAUDE.md フォーム規約（#262）の「自前 isDirty 実装は禁止」に抗触している。`@tanstack/react-form` が提供する `state.isDefaultValue` を利用して統一する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `form.Subscribe` の selector に `isDirty: !state.isDefaultValue` を追加
- 手動 `isDirty` 計算（`savedValuesRef` との比較）を削除
- `savedValuesRef`（`useRef`）を削除
- `useRef` を import から除去

**やらないこと:**
- useForm 以外のフォーム移行対応
- AccountScene 以外のファイルの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `isDirty` の自前計算コードが削除され、`form.Subscribe` の `!state.isDefaultValue` から取得する
2. `savedValuesRef` および `useRef` が削除される
3. 保存ボタンは初期値と同じ場合に disabled、変更があれば enabled になる
4. 変更後に初期値へ戻すと保存ボタンが再び disabled になる
5. 既存の `AccountScene.test.tsx` が全て pass する
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

`state.isDirty` と `state.isDefaultValue` は TanStack Form v1.33 で意味が異なる:

- `isDirty`: `setFieldValue` の履歴を追跡するフラグ。ユーザーが一度でも入力すると `true` になり、元の値に戻しても `form.reset()` を呼ぶまで `false` に戻らない。
- `isDefaultValue`: 全フィールドの現在値と defaultValues を `deepEqual` で比較する純粹な値比較フラグ。値が元に戻れば `true`（dirty 、0）に戻る。

受け入れ条件 §3-4「変更後に初期値へ戻すと保存ボタンが再び disabled」は `state.isDirty` では実現不可能。`isDirty: !state.isDefaultValue` を使用する。

`form.Subscribe` の selector で `isDirty: !state.isDefaultValue` とすることで、値が変更されたとき `isDirty = true`、元に戻ったとき `isDirty = false` という期待動作が実現できる。

`savedValuesRef` は `useEffect` 内の `savedValuesRef.current = values` 行と宣言ごと削除する。`useEffect` 内の `form.reset(values)` は引き続き必要（authUser ロード後の同期）。`form.reset(values)` は現在値と defaultValues の両方を更新するため、`isDefaultValue` の判定基準が正しく更新される。

## 5. 影響範囲 / 既存への変更

- `client/src/routes/AccountScene.tsx` のみ変更

## 6. テスト計画

既存テスト（`AccountScene.test.tsx`）の「編集フォームのdirty判定 (#179)」ブロックが受け入れ条件を網羅済み:
- 変更なし → disabled
- 変更あり → enabled
- 変更後に初期値へ戻す → disabled

実装変更なので新規テスト追加は不要。既存テストが全て緑になることを確認する。

## 7. リスク・未決事項

`state.isDirty` ではなく `state.isDefaultValue` を使う理由: TanStack Form v1.33 の `isDirty` はフィールドがタッチされたことを示すフラグで、値が元に戻っても `false` に戻らない。`isDefaultValue` は現在値とデフォルト値の深い比較に基づくため、値の同一性チェックに適している。
