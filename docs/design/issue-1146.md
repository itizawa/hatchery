# 設計書: 未ログイン時のヘッダーをゲストアイコン＋メニュー経由のログイン導線に変更する (#1146)

## 1. 目的 / 背景

未ログイン時のヘッダー右端（`AppHeaderAuthSection`、`client/src/components/AppHeader.tsx`）は「ログイン」という文字リンクを直接表示しており、ログイン済み時（Avatar アイコン → クリックで Menu）と操作感が非対称になっている。未ログイン時もゲストアイコン → クリックでメニュー → 「ログイン」という統一 UI にする。

## 2. スコープ（やること / やらないこと）

- やること: `AppHeaderAuthSection` の未ログイン分岐を、ゲストアイコンボタン（`AccountCircleRounded`）+ `Menu`/`MenuItem`（「ログイン」）に変更する。
- やらないこと: ログインモーダル自体（`LoginDialog.tsx`）・ログイン方式（Google 認証）の変更。ゲストアイコンをアバター画像等にする対応。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 未ログイン時、`aria-label="ゲストメニュー"` の `button` がヘッダー右端に表示される。
2. ゲストメニューボタンをクリックすると `Menu` が開き、「ログイン」`menuitem` が表示される。
3. 「ログイン」`menuitem` をクリックすると、ページ遷移せずログインモーダルが開く（背景コンテンツは保持される）。既存の `handleLoginClick` / `openLogin()` の挙動を踏襲する。
4. ログイン済み時はゲストメニューボタンが表示されない（既存のユーザーメニューボタンのみ）。
5. ヘッダー右端スロットの固定高さ（40px, #485）はゲストメニューボタンでも維持される。

## 4. 設計方針

- `AppHeaderAuthSection` の `!user` 分岐を、ログイン済み分岐（`ButtonBase` + `Avatar` + `Menu`/`MenuItem`）と同じ構造に揃える。
- 同一コンポーネント内では未ログイン/ログイン済みのどちらか一方しか描画されないため、既存の `anchorEl`/`open`/`handleOpen`/`handleClose` の state をそのまま両分岐で共用する。
- ゲストアイコンは `Avatar`（背景をニュートラルなグレー `rgba(0,0,0,0.08)`、前景色 `SLACK_COLORS.sidebarText`）の中に `AccountCircleRounded`（Rounded バリアント、CLAUDE.md アイコン規約）を配置し、ログイン時の Avatar と同一サイズ（`ACCOUNT_ICON_SIZE`）・同一余白にして `RIGHT_SLOT_HEIGHT` を崩さない。
- 「ログイン」`MenuItem` は既存の `Link`（`component={RouterLink}` + `to="."` + `search` で `?login=1` を付与）の実装をそのまま `MenuItem` に載せ替え、`href` を保持したまま（リロード・共有リンク互換）クリック時は `handleLoginClick`（`preventDefault` + `openLogin()`）でモーダルのみ開く。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `client` のみ（`server`/`common`/`docs` への変更なし）。
- 変更ファイル: `client/src/components/AppHeader.tsx`、`client/src/components/AppHeader.test.tsx`。

## 6. テスト計画（TDD で書くテスト一覧）

- 未ログイン時にゲストメニュートリガー（アイコンボタン）が表示される（#255 系テストの置き換え）。
- ゲストメニュートリガークリックで「ログイン」`menuitem` が表示される。
- 「ログイン」`menuitem` クリックでログインモーダルが開き、背景が保持される（既存の直接リンククリックテストの置き換え）。
- ログアウト成功後にゲストメニュートリガーへ切り替わる（既存テストの表示先変更）。
- ログイン済み時にゲストメニュートリガーが表示されない。
- 高さ一定化テスト（#485）の未ログイン時アサーションをゲストメニュートリガー待ちに更新。

## 7. リスク・未決事項

- 既存の e2e（`e2e/auth/usecases.md` UC-AUTH-01, UC-AUTH-04）の記述をこの PR で更新する。
