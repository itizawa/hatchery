# Issue #202 設計書: 入力系 Zod スキーマの未設定フィールドに .max() を付与

## 概要

`CLAUDE.md` バリデーションルール #91 に従い、未設定の入力系 Zod スキーマフィールドに `.max()` 上限を追加する。
既存の実装を確認した結果、以下が未対応:

- `UpdateProfileSchema.avatarUrl` — URL 形式のみで上限なし
- `AddChannelMemberSchema.employeeId` — `.min(1)` のみで `.max()` なし
- クライアント `AccountScene` の `avatarUrl` フォームフィールドに `inputProps.maxLength` なし

## 現状確認

調査の結果、Issue 起票時点から以下は既に実装済み:
- `LoginRequestSchema.loginId` / `password` — `LOGIN_ID_MAX_LENGTH` / `PASSWORD_MAX_LENGTH` 定数あり
- `UpdateProfileSchema.displayName` — `DISPLAY_NAME_MAX_LENGTH` 定数あり
- `UpdateAppSettingSchema.key` / `value` — `APP_SETTING_KEY_MAX_LENGTH` / `APP_SETTING_VALUE_MAX_LENGTH` 定数あり
- クライアント LoginScene, SettingsScene の該当フィールドに `maxLength` 設定済み
- クライアント AccountScene の `displayName` フィールドに `maxLength` 設定済み

## 残作業

### common パッケージ

1. `common/src/domain/auth/auth.ts`
   - `UpdateProfileSchema.avatarUrl` に `.max(AVATAR_URL_MAX_LENGTH)` を追加
   - `AVATAR_URL_MAX_LENGTH = 2048` 定数を定義（RFC 準拠の URL 長制限）

2. `common/src/domain/channelMembership/channelMembership.ts`
   - `AddChannelMemberSchema.employeeId` に `.max(EMPLOYEE_ID_MAX_LENGTH)` を追加
   - `EMPLOYEE_ID_MAX_LENGTH = 100` 定数を定義

### client パッケージ

3. `client/src/routes/AccountScene.tsx`
   - `avatarUrl` テキストフィールドに `inputProps={{ maxLength: AVATAR_URL_MAX_LENGTH }}` を追加
   - `AVATAR_URL_MAX_LENGTH` を `@hatchery/common` からインポート

### テスト

各フィールドについて TDD 方式で:
- 上限内は通る（境界値: `.max(N)` なら `N` 文字は成功）
- 上限超過は弾く（境界値: `N+1` 文字は失敗）

## 上限値の根拠

| フィールド | 上限 | 根拠 |
|-----------|------|------|
| `avatarUrl` | 2048 | URL の事実上の最大長（RFC 2616 非公式だが実用的基準） |
| `employeeId` | 100 | ID 系フィールドの実用的上限（既存 channelId などは短く設計） |

## 変更ファイル一覧

- `common/src/domain/auth/auth.ts` — `AVATAR_URL_MAX_LENGTH` 追加 + `UpdateProfileSchema.avatarUrl` に `.max()`
- `common/src/domain/auth/auth.test.ts` — `UpdateProfileSchema.avatarUrl` の max テスト追加
- `common/src/domain/channelMembership/channelMembership.ts` — `EMPLOYEE_ID_MAX_LENGTH` 追加 + `AddChannelMemberSchema.employeeId` に `.max()`
- `common/src/domain/channelMembership/channelMembership.test.ts` — `AddChannelMemberSchema.employeeId` の max テスト追加
- `client/src/routes/AccountScene.tsx` — `avatarUrl` フィールドに `inputProps.maxLength` 追加
