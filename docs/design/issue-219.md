# Issue #219 設計書: 管理画面のタブ名を「ワーカー管理」にする

## 背景・目的

ADR-0018 のピボット再定義に伴い、公共型コミュニティ（Reddit 風）モデルでは「ユーザー」「従業員」という会社モデルの呼称が実態に合わない。管理対象は **AI ワーカー** であるため、管理画面の該当タブのラベルを「ユーザー一覧」から「ワーカー管理」に変更する。

## 変更対象

### `client/src/routes/SettingsScene.tsx`

`SETTINGS_TABS` 配列の最初の要素（`value: "users"`）の `label` を変更する:

```ts
// Before
{ label: "ユーザー一覧", value: "users", content: <EmployeeTable /> }

// After
{ label: "ワーカー管理", value: "users", content: <EmployeeTable /> }
```

`value` は URL パラメータ（`?tab=users`）として使用されるため変更しない。ラベル（表示文字列）のみ変更する。

### `client/src/routes/SettingsScene.test.tsx`

テスト内で「ユーザー一覧」というラベルを参照している箇所を「ワーカー管理」に更新する。

## 受け入れ条件

1. 管理画面の該当タブのラベルが「ワーカー管理」と表示される
2. 関連するコンポーネントテスト / Storybook stories のラベル期待値を更新する
3. `pnpm turbo run build|test|lint` 緑

## 設計判断

- `value: "users"` は変更しない（URL 互換性を保持するため）
- ラベルのみ「ワーカー管理」に変更する
- TDD: まずテストの期待値を「ワーカー管理」に更新し（失敗を確認）、次に実装を更新して緑にする
