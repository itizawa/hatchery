# 設計書: fix: ユーザー入力文字列の Zod スキーマに .max() 上限を付与する（#91 規約違反の解消） (#173)

## 1. 目的 / 背景

CLAUDE.md「バリデーションルール」（#91）は「ユーザーが入力する文字列フィールドは、Zod スキーマで必ず `.max()` による上限を設定すること」を必須規約とし、フロントエンドでも `inputProps={{ maxLength: N }}` で二重防御することを求めている。

Issue 作成時点では `LoginRequestSchema` の `id` / `password` も対象だったが、#185（User サロゲートキー化）で `loginId: z.string().min(1).max(50)` / `password: z.string().min(1).max(100)` が実装済み。ただし定数名が無い（マジックナンバー直書き）ため、本 Issue で名前付き定数への置き換えも行う。

## 2. スコープ（やること / やらないこと）

### やること

- `common/src/domain/auth/auth.ts`: 名前付き定数を export し、`LoginRequestSchema` のマジックナンバーを置き換え、`UpdateProfileSchema.displayName` に `.max()` を追加
- `common/src/domain/employee/employee.ts`: 名前付き定数を export し、`EmployeeSchema` / `UpdateEmployeeSchema` の `displayName` / `role` に `.max()` を追加
- `common/src/domain/appSetting/appSetting.ts`: 名前付き定数を export し、`AppSettingSchema` / `UpdateAppSettingSchema` の `key` / `value` に `.max()` を追加
- 各スキーマの単体テスト追加（上限ちょうどは通る／上限+1 は失敗）
- クライアントフォームへの `inputProps={{ maxLength: <共有定数> }}` 追加:
  - `LoginScene.tsx`（loginId / password）
  - `AccountScene.tsx`（displayName）
  - `SettingsScene.tsx`（ApiTokenSettings の apiKey = CLAUDE_API_KEY value）

### やらないこと

- 出力専用スキーマ（`AuthUserSchema` / `AppSettingResponseSchema`）への `.max()` 付与（ユーザー入力ではないため）
- `EmployeeTable.tsx` への `inputProps` 追加（現時点で編集フォームが存在しない。#217/#218 で編集フォーム実装時に追加する）
- `SettingsScene.tsx` のユーザー一覧タブの社員 displayName / role 編集（同上）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `common` 配下の各スキーマで、上限ちょうど（N 文字）は `safeParse` が `success: true`
2. `common` 配下の各スキーマで、上限+1（N+1 文字）は `safeParse` が `success: false`
3. 各上限値は named export の定数として定義され、スキーマと UI で共有される
4. クライアントの対象フォームに `inputProps={{ maxLength: <共有定数> }}` が付与される
5. `pnpm turbo run build` / `pnpm turbo run test` / `pnpm turbo run lint` が全て緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 定数の配置

各ドメインファイルに named export として定義する。`channel.ts` の `CHANNEL_LABEL_MAX_LENGTH` パターンを踏襲。

| ドメイン | 定数名 | 値 | 根拠 |
|---|---|---|---|
| auth.ts | `LOGIN_ID_MAX_LENGTH` | 100 | ユーザー識別子として十分、DB varchar(100) を想定 |
| auth.ts | `PASSWORD_MAX_LENGTH` | 128 | bcrypt の実効長を超えない範囲で余裕を持つ値 |
| auth.ts | `DISPLAY_NAME_MAX_LENGTH` | 50 | UI 表示幅・channel.ts の CHANNEL_LABEL_MAX_LENGTH と統一 |
| employee.ts | `EMPLOYEE_DISPLAY_NAME_MAX_LENGTH` | 50 | UI 表示幅（auth の DISPLAY_NAME_MAX_LENGTH と同値） |
| employee.ts | `EMPLOYEE_ROLE_MAX_LENGTH` | 50 | 役職名は短め（「ムードメーカー」程度） |
| appSetting.ts | `APP_SETTING_KEY_MAX_LENGTH` | 100 | 設定キー名（CLAUDE_API_KEY 等）は短い |
| appSetting.ts | `APP_SETTING_VALUE_MAX_LENGTH` | 1000 | 暗号化済み API キーを格納しうるため大きめ |

### auth.ts の loginId 上限値の修正

現在は `.max(50)` だが、`LOGIN_ID_MAX_LENGTH = 100` に変更する。理由: Issue 本文の目安が「ログイン id: 100」であり、User 識別子として 50 文字は狭い（メールアドレス等を将来的に使う場合を考慮）。既存テストも合わせて更新する。

> **注意**: `password` の `.max(100)` は現在も `.max(100)` だが、`PASSWORD_MAX_LENGTH = 128` に変更する。Issue 本文の目安「password: 128」に合わせる。

## 5. 影響範囲 / 既存への変更

- **common**: `auth.ts` / `employee.ts` / `appSetting.ts` のスキーマ変更（後方互換：上限追加は制約強化）
- **client**: `LoginScene.tsx` / `AccountScene.tsx` / `SettingsScene.tsx` の TextField に `inputProps` 追加（UI 動作変更なし）
- **server**: スキーマは server でも Zod バリデーションに使用されるが、`.max()` 追加は OpenAPI の `maxLength` に反映されるのみで API 互換は維持される

## 6. テスト計画（TDD で書くテスト一覧）

### common/src/domain/auth/auth.test.ts への追記

- `LoginRequestSchema`: loginId が `LOGIN_ID_MAX_LENGTH` 文字ちょうど → success
- `LoginRequestSchema`: loginId が `LOGIN_ID_MAX_LENGTH + 1` 文字 → failure
- `LoginRequestSchema`: password が `PASSWORD_MAX_LENGTH` 文字ちょうど → success
- `LoginRequestSchema`: password が `PASSWORD_MAX_LENGTH + 1` 文字 → failure
- `UpdateProfileSchema`: displayName が `DISPLAY_NAME_MAX_LENGTH` 文字ちょうど → success
- `UpdateProfileSchema`: displayName が `DISPLAY_NAME_MAX_LENGTH + 1` 文字 → failure

### common/src/domain/employee/employee.test.ts への追記

- `EmployeeSchema`: displayName が `EMPLOYEE_DISPLAY_NAME_MAX_LENGTH` 文字ちょうど → success
- `EmployeeSchema`: displayName が `EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1` 文字 → failure
- `EmployeeSchema`: role が `EMPLOYEE_ROLE_MAX_LENGTH` 文字ちょうど → success
- `EmployeeSchema`: role が `EMPLOYEE_ROLE_MAX_LENGTH + 1` 文字 → failure
- `UpdateEmployeeSchema`: displayName が `EMPLOYEE_DISPLAY_NAME_MAX_LENGTH` 文字ちょうど → success
- `UpdateEmployeeSchema`: displayName が `EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1` 文字 → failure
- `UpdateEmployeeSchema`: role が `EMPLOYEE_ROLE_MAX_LENGTH` 文字ちょうど → success
- `UpdateEmployeeSchema`: role が `EMPLOYEE_ROLE_MAX_LENGTH + 1` 文字 → failure

### common/src/domain/appSetting/appSetting.test.ts（新規作成）

- `AppSettingSchema`: key が `APP_SETTING_KEY_MAX_LENGTH` 文字ちょうど → success
- `AppSettingSchema`: key が `APP_SETTING_KEY_MAX_LENGTH + 1` 文字 → failure
- `AppSettingSchema`: value が `APP_SETTING_VALUE_MAX_LENGTH` 文字ちょうど → success
- `AppSettingSchema`: value が `APP_SETTING_VALUE_MAX_LENGTH + 1` 文字 → failure
- `UpdateAppSettingSchema`: key が `APP_SETTING_KEY_MAX_LENGTH` 文字ちょうど → success
- `UpdateAppSettingSchema`: key が `APP_SETTING_KEY_MAX_LENGTH + 1` 文字 → failure
- `UpdateAppSettingSchema`: value が `APP_SETTING_VALUE_MAX_LENGTH` 文字ちょうど → success
- `UpdateAppSettingSchema`: value が `APP_SETTING_VALUE_MAX_LENGTH + 1` 文字 → failure

## 7. リスク・未決事項

- `loginId` の上限を 50 → 100 に変更することで、既存テスト `LoginRequestSchema` の成功ケースは影響なし。ただし「50文字以上で失敗する」系のテストが存在する場合は修正が必要（現時点では存在しない）。
- `password` の上限を 100 → 128 に変更することで、既存テストへの影響なし（100文字の password を渡すテストがあれば影響するが、現時点ではそのようなテストはない）。
- 出力専用スキーマへの `.max()` 追加は本 Issue の対象外とする（`AuthUserSchema.displayName` 等はサーバ→クライアントの出力のため、DB から取得した値に上限を設けると既存データが validation に失敗する恐れがある）。
