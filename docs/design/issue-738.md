# Issue #738 設計書: e2e/account の UC-ACCOUNT-01〜04 を Playwright テストとして実装する

## 概要

`e2e/account/account.spec.ts` の 4 件の `test.todo()` を実 Playwright テストに置き換える。
`/account` 画面（AccountScene）のプロフィール編集フローをブラウザ上で自動検証する。

## 対象ユースケース

| UC 番号 | 内容 |
|---------|------|
| UC-ACCOUNT-01 | 表示名を変更して保存できる（成功 Snackbar 表示・フォーム反映） |
| UC-ACCOUNT-02 | 変更なしは保存ボタン disabled・変更後は enabled・戻すと再び disabled |
| UC-ACCOUNT-03 | 不正 URL 入力でエラーメッセージが表示され保存できない |
| UC-ACCOUNT-04 | API 失敗時にエラー Snackbar が表示される |
| UC-ACCOUNT-05 | ?welcome=1 で歓迎メッセージ（スコープ外: test.todo のまま維持） |

## 実装方針

### モックパターン（home-feed.spec.ts に準拠）

`page.route()` で API をインターセプトする方式を採用。msw のサービスワーカー基盤ではなく、Playwright ネイティブのルートモック（`page.route()`）を用いる（home-feed.spec.ts の既存パターンに準拠）。

### 必要な API モック

| エンドポイント | 用途 |
|---------------|
| `GET /api/auth/me` | 認証済みユーザー情報（初期フォーム値） |
| `PATCH /api/auth/me` | プロフィール更新（成功・失敗） |
| `GET /api/communities` | サイドバー（レイアウト共通部品） |

### テスト別のモック設定

**共通 (`setupAuthMock`)**:
- `GET /api/auth/me` → 200 + `{ id: "user1", displayName: "旧名前", ... }`
- `GET /api/communities` → 200 + `[]`（サイドバー用）

**UC-ACCOUNT-01**:
- `PATCH /api/auth/me` → 200 + 更新後の AuthUser
- 期待: 成功 Snackbar「保存しました」が表示される

**UC-ACCOUNT-02**:
- `PATCH /api/auth/me` モック不要（保存しない）
- 期待: 初期状態で保存ボタン disabled・入力変更後 enabled

**UC-ACCOUNT-03**:
- `PATCH /api/auth/me` モック不要（バリデーションで弾かれる）
- 期待: 「有効な URL を入力してください」エラーメッセージ

**UC-ACCOUNT-04**:
- `PATCH /api/auth/me` → 500 エラー
- 期待: エラー Snackbar（「プロフィールの更新に失敗しました」等）が表示される

## AccountScene の UI 構造（確認済み）

- `TextField[label="表示名"]` — displayName フィールド
- `TextField[label="プロフィール画像 URL"]` — avatarUrl フィールド（任意）
- `Button[type="submit"]` — 「保存」ボタン（isDirty かつ canSubmit のとき有効）
- 成功 Snackbar: `Alert[severity="success"]` に「保存しました」
- エラー Snackbar: `Alert[severity="error"]` に `getApiErrorMessage` の結果

## ファイル変更

- `e2e/account/account.spec.ts` — `test.todo()` 4 件を実テストに置き換え（UC-ACCOUNT-05 は維持）

## インポート変更

home-feed.spec.ts と同様に `@playwright/test` の `{ expect, test }` を直接使用
（`../support/test.js` を経由しないパターン）。`test.todo()` の 5 件目だけは `test.fixme` 形式のラッパーが必要なため、`../support/test.js` 経由のまま維持するか、実テスト 4 件は `@playwright/test` から import して UC-ACCOUNT-05 だけ別ブロックに残す方針とする。

→ 採用: import を `@playwright/test` に変更し、UC-ACCOUNT-05 は `test.fixme()` で直接記述する。
