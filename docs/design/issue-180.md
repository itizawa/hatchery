# 設計書: fix: ログインフォームの入力欄に autocomplete 属性を付与しブラウザ警告を解消する (#180)

## 1. 目的 / 背景

`client/src/routes/LoginScene.tsx` の ID 欄・パスワード欄に `autocomplete` 属性が無く、ブラウザコンソールに `[DOM] Input elements should have autocomplete attributes` 警告が出ている。また `SettingsScene.tsx` の API キー欄（`type="password"`）も同種の警告対象。適切な属性を付与することでブラウザ警告を解消し、パスワードマネージャとの相性を改善する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `LoginScene.tsx`: ID 欄に `autocomplete="username"`、パスワード欄に `autocomplete="current-password"` を付与
- `SettingsScene.tsx`: API キー欄（`type="password"`）に `autocomplete="off"` を付与
- 各変更箇所の RTL テストを追加

**やらないこと:**
- 新規ユーザー登録フォーム（未実装）への対応
- 表示名・画像 URL 等の非認証フィールドへの autocomplete 付与

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `LoginScene` の ID 入力欄（`aria-label="ID"`）に `autocomplete="username"` が設定されている
2. `LoginScene` のパスワード入力欄（`aria-label="パスワード"`）に `autocomplete="current-password"` が設定されている
3. `SettingsScene` の Claude API キー入力欄（`label="Claude API キー"`）に `autocomplete="off"` が設定されている
4. 既存テストがすべて通過する（既存の挙動・aria属性・type 等を破壊しない）
5. `pnpm turbo run build|test|lint` が緑

## 4. 設計方針

MUI `TextField` の `inputProps` に `autocomplete` プロパティを追加する。`inputProps` は MUI が実際の `<input>` 要素へ渡すため、ブラウザが `autocomplete` 属性として認識できる。

```tsx
// LoginScene.tsx（ID欄）
inputProps={{ "aria-label": "ID", maxLength: LOGIN_ID_MAX_LENGTH, autoComplete: "username" }}

// LoginScene.tsx（パスワード欄）
inputProps={{ "aria-label": "パスワード", maxLength: PASSWORD_MAX_LENGTH, autoComplete: "current-password" }}

// SettingsScene.tsx（APIキー欄）
inputProps={{ maxLength: APP_SETTING_VALUE_MAX_LENGTH, autoComplete: "off" }}
```

**注意**: React の DOM プロパティとして `autoComplete`（camelCase）を使用する。MUI TextField が実際の `<input>` に `autocomplete` 属性（lowercase）として設定する。

## 5. 影響範囲 / 既存への変更

- **client**: `LoginScene.tsx`・`SettingsScene.tsx`・`LoginScene.test.tsx`・`SettingsScene.test.tsx`
- **server / common / docs**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

`LoginScene.test.tsx`:
- ID 入力欄の autocomplete="username" を検証
- パスワード入力欄の autocomplete="current-password" を検証

`SettingsScene.test.tsx`:
- Claude API キー欄の autocomplete="off" を検証

## 7. リスク・未決事項

- MUI TextField は `inputProps.autoComplete` を HTML `autocomplete` 属性にマップする（確認済みの挙動）。
- 既存の `aria-label`・`maxLength` は維持するため、既存テストに影響なし。
