# 設計書: 設定画面の実装（サイドバーから開く / ユーザー一覧タブで AI ボットをテーブル表示） (#25)

## 1. 目的 / 背景

サイドバーからアクセスできる **設定画面** を新設し、その **ユーザー一覧タブ** に AI ボット（AI 社員）をテーブル表示する。観察エンタメ Hatchery において「どんな社員がいるのか」を一覧で確認できる入り口を用意する第一歩。

client スタック（#7）で構築済みの Slack 風シェル（`RootLayout` の左サイドバー + TanStack Router）に、設定への導線とユーザー一覧の中身を追加する。データは既存の `ChannelList` が `DEFAULT_CHANNELS`（common 定数）を直接描画するのと同じパターンで、common に新設する **`DEFAULT_EMPLOYEES`** を単一情報源とする（client → common 直依存）。server API・型共有パイプライン（#8）には依存しない。

現状 `/settings` ルートと認証ガード（`beforeLoad` で未ログインなら `/login`）は既に存在し、`SettingsScene` はプレースホルダー（`#25 で実装予定`）。本 Issue でその中身を実装する。

## 2. スコープ（やること / やらないこと）

### やること
- common に `DEFAULT_EMPLOYEES`（`Employee[]`、`EmployeeSchema` 準拠、MVP の 3 人）を新設・エクスポート
- サイドバー（`RootLayout`）に設定画面への導線（リンク）を追加
- `SettingsScene` をタブ UI（MUI Tabs）で実装し、「ユーザー一覧」タブを持つ
- ユーザー一覧タブで `DEFAULT_EMPLOYEES` を MUI Table で表示（列: 表示名 / 役割）

### やらないこと（スコープ外）
- server の employees エンドポイント追加・型共有パイプライン（#8）経由のデータ取得
- AI ボットの CRUD（本 Issue は閲覧のみ）
- ユーザー一覧以外のタブの中身（会社設定・定時設定など）
- 経験値・進化・関係値・認証/権限の拡張（Phase 1 以降）
- Storybook stories の追加（#25 の受け入れ条件外。#30 等の責務）

## 3. 受け入れ条件（テストに落とせる粒度）

### common
- [ ] `DEFAULT_EMPLOYEES` がエクスポートされ、全要素が `EmployeeSchema` を満たす
- [ ] `DEFAULT_EMPLOYEES` は MVP の 3 人（`haru` / `ken` / `mei`、既存テスト・ロジックの社員 ID と整合）を含む
- [ ] 各要素の `id` は一意

### client（コンポーネント）
- [ ] ユーザー一覧テーブル（presentational）が `DEFAULT_EMPLOYEES` の全社員の表示名を描画する
- [ ] テーブルの列に **表示名（displayName）・役割（role）** を含む
- [ ] `role` 未設定の社員でも行が破綻せずフォールバック表示（`—`）される
- [ ] 各行が `Employee.id` を key として一意に描画される

### client（画面 / 導線）
- [ ] サイドバーに設定画面への導線があり、クリックで `/settings` に遷移できる
- [ ] `SettingsScene` はタブ UI を持ち「ユーザー一覧」タブが存在する（初期表示は当該タブ）
- [ ] 設定画面の見出し（`設定`）は維持され、既存の認証ガードテストを壊さない
- [ ] ログイン済みで「設定導線クリック → 設定画面表示 → ユーザー一覧タブに全 AI ボットの表示名が出る」

### 品質
- [ ] `turbo run lint test build` が緑

## 4. 設計方針

- **common**: `common/src/domain/employee/employee.ts` に `DEFAULT_EMPLOYEES: readonly Employee[]` を追加（`DEFAULT_CHANNELS` の定義パターンを踏襲）。既存の `employee/index.ts` 経由で common ルートから自動エクスポートされる。社員 ID は既存テスト（`selectAppearingMembers.test.ts` / `message.test.ts`）と同じ `haru` / `ken` / `mei` を採用し一貫性を保つ。
- **client（presentational）**: `client/src/components/EmployeeTable.tsx` を新設。`ChannelList` と同様に common の `DEFAULT_EMPLOYEES` を直接描画する（client → common 直依存）。MUI Table を使用。`role` が未設定なら `—` を表示。
- **client（画面）**: `SettingsScene` を MUI `Tabs` で実装。タブ定義は配列駆動（`{ label, value, content }[]`）にして将来のタブ追加を妨げない。初期タブは「ユーザー一覧」。見出し `設定`（`<h1>`）は維持。
- **client（導線）**: `RootLayout` のサイドバーに TanStack Router の `Link`（`to="/settings"`）を追加。既存のチャンネル一覧・ホーム遷移の表示/挙動は変更しない。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **common**, **client**
- common: `domain/employee/employee.ts`（追記）/ `employee.test.ts`（追記）
- client: 新規 `components/EmployeeTable.tsx` + `.test.tsx`、`routes/SettingsScene.tsx`（プレースホルダー→実装）+ 新規 `SettingsScene.test.tsx`、`routes/RootLayout.tsx`（リンク追加）
- 既存テスト（`LoginScene.test.tsx` の認証ガード、`AppRoot.test.tsx`）は見出し `設定` 維持・サイドバー既存挙動維持により影響なし

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/employee/employee.test.ts`: `DEFAULT_EMPLOYEES` が全要素 `EmployeeSchema` 準拠 / 3 人 / id 一意
2. `client/src/components/EmployeeTable.test.tsx`: 全 `DEFAULT_EMPLOYEES` の表示名が描画される / role 列が出る / role 未設定はフォールバック表示
3. `client/src/routes/SettingsScene.test.tsx`: ログイン済みで `/` から設定導線クリック → 設定画面表示 → ユーザー一覧タブに全社員の表示名が出る（memory history + `fetchMe` モック）

## 7. リスク・未決事項

- `DEFAULT_EMPLOYEES` の表示名・役割は MVP 暫定。プロンプト設計（Phase 1）で正典の社員定義が固まれば差し替える。
- 認証ガード経由の遷移テストは `fetchMe` のモックに依存（既存 `LoginScene.test.tsx` のパターンを踏襲）。
