# 設計書: AccountScene.tsx の isDirty 判定を @tanstack/react-form の state.isDirty に置き換える (#900)

## 1. 目的 / 背景

`client/src/routes/AccountScene.tsx` の保存ボタン disabled 制御で `savedValuesRef` を使った手動 isDirty 計算をしており、CLAUDE.md フォーム規約（#262）の「自前 isDirty 実装は禁止」に抵触している。`@tanstack/react-form` が提供する `state.isDirty` を利用して統一する。

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

`state.isDirty` は TanStack Form v1.33 において「フィールドがタッチされたか」を追跡するフラグであり、値が元に戻っても `true` のままになる。値とデフォルト値の比較には `state.isDefaultValue` を使う。

`state.isDefaultValue` は各フィールドの現在値とデフォルト値を `deepEqual` で比較し、全フィールドがデフォルト値と一致する場合に `true` となる。`form.reset(values)` でデフォルト値も更新されるため、authUser ロード後に `form.reset(values)` を呼ぶ既存実装と整合する。

`form.Subscribe` の selector で `isDirty: !state.isDefaultValue` とすることで、値が変更されたとき `isDirty = true`、元に戻ったとき `isDirty = false` という期待動作が実現できる。

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
