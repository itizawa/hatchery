# 設計書: AI利用の基盤を整える (#52)

## 1. 目的 / 背景

管理画面から Claude API トークンを設定・保存できるようにする。
保存されたトークンは #53 の AI メッセージ生成バッチで利用する。
API キーをコードや環境変数にハードコードせず、DB 管理で柔軟に切り替えられる運用を実現する。

## 2. スコープ（やること / やらないこと）

### やること
- `AppSetting` モデル（キーバリュー形式）を Prisma スキーマに追加しマイグレーションを作成
- AES-256-GCM 暗号化ユーティリティ（`APP_SECRET` 環境変数使用）
- `GET /admin/settings`（認証必須）: 設定一覧取得（API キーはマスク表示）
- `PATCH /admin/settings`（認証必須）: 設定更新（暗号化して保存）
- バッチ実行時の復号 API（DB 優先、未設定なら環境変数 `ANTHROPIC_API_KEY` フォールバック）
- 管理画面「API トークン設定」タブ（パスワード入力 + 保存ボタン + マスク表示 + トースト）
- OpenAPI スキーマへの定義追加

### やらないこと
- #53 の AI バッチ実装自体
- ロールベース認可（管理者のみなど）の追加
- 複数環境分離（dev/prod でのキー分割）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `AppSetting` モデルが Prisma スキーマに存在し、`key: String @id` / `value: String` / `updatedAt: DateTime` を持つ
- 暗号化・復号のユニットテスト: 暗号化した値を復号すると元のテキストに戻る
- `GET /admin/settings` が認証なしで 401 を返す
- `GET /admin/settings` が認証済みで 200 と設定一覧を返す（`CLAUDE_API_KEY` はマスク表示）
- `PATCH /admin/settings` が認証なしで 401 を返す
- `PATCH /admin/settings` が `{ key: "CLAUDE_API_KEY", value: "sk-ant-test" }` で 200 を返す
- `PATCH /admin/settings` のバリデーション: key が空なら 400
- `getApiKey()` が DB の値（復号済み）を優先し、なければ環境変数 `ANTHROPIC_API_KEY` を返す
- `getApiKey()` が DB の値も環境変数も未設定なら `undefined` を返す

## 4. 設計方針

### 暗号化
- アルゴリズム: AES-256-GCM（認証付き暗号化、改竄検知あり）
- 鍵導出: `APP_SECRET` を `crypto.createHash('sha256').digest()` で 32 bytes に変換
- フォーマット: `base64(iv):base64(authTag):base64(encrypted)` をコロン区切りで 1 文字列に格納
- `APP_SECRET` 未設定時: テスト/開発環境では `hatchery-dev-secret` をデフォルトとする

### API キーマスク表示
- `sk-ant-api...` → 先頭 11 文字 + `****` で返す
- 値が未設定の場合は `null` を返す

### アーキテクチャ（common→server の一方向依存を維持）
- `common/src/domain/appSetting/` に `AppSettingSchema` / `UpdateAppSettingSchema` を置く
- `server` は common のスキーマを参照してバリデーション・OpenAPI 定義を行う

### リポジトリパターン
- `AppSettingRepository` インターフェース + `InMemoryAppSettingRepository`（テスト用）
- `PrismaAppSettingRepository` は本番用（Prisma 依存）
- 依存注入: `AppDeps` に `appSettingRepository?` を追加

## 5. 影響範囲 / 既存への変更

- `common/`: 新規ドメイン `appSetting` 追加
- `server/prisma/schema.prisma`: `AppSetting` モデル追加
- `server/src/utils/crypto.ts`: 新規
- `server/src/persistence/appSettingRepository.ts`: 新規
- `server/src/routes/admin.ts`: 新規
- `server/src/app.ts`: `AppDeps` と router 登録追加
- `server/src/openapi/registry.ts`: admin エンドポイント追加
- `server/.env.example`: `APP_SECRET` 追加
- `client/src/api/admin.ts`: 新規
- `client/src/routes/SettingsScene.tsx`: API トークン設定タブ追加

## 6. テスト計画（TDDで書くテスト一覧）

### server/src/utils/crypto.test.ts
- encrypt → decrypt で元の値が復元される
- 異なる平文を暗号化すると異なる暗号文になる（IV ランダム性）
- 不正な暗号文を復号しようとすると例外を投げる

### server/src/routes/admin.test.ts
- GET /admin/settings: 未認証 → 401
- GET /admin/settings: 認証済み・設定なし → 200 + 空/デフォルトリスト
- GET /admin/settings: CLAUDE_API_KEY 設定済み → マスク表示で返す
- PATCH /admin/settings: 未認証 → 401
- PATCH /admin/settings: key 空 → 400
- PATCH /admin/settings: CLAUDE_API_KEY 設定 → 200 + マスク表示
- getApiKey: DB 未設定・env 未設定 → undefined
- getApiKey: DB 設定済み → 復号値
- getApiKey: DB 未設定・env 設定済み → env 値

## 7. リスク・未決事項

- Prisma マイグレーションは DB 接続なしで SQL を手書きで作成する（CI/開発環境で `prisma migrate deploy` 実行が必要）
- `APP_SECRET` 未設定の本番環境では起動時エラーを出すことを検討したが、`SESSION_SECRET` と同様のパターン（開発はデフォルト値）を採用してシンプルにする
