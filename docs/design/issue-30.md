# 設計書: チャンネル詳細画面の実装（channel のメッセージ一覧を表示 / Storybook + mdx 設計書で動作確認） (#30)

## 1. 目的 / 背景

チャンネル別ビュー（`/channels/$channelId`）の詳細画面を実装する。現在 `ChannelScene`
（`client/src/routes/ChannelScene.tsx`）はチャンネル ID を表示するだけのスタブ。本 Issue では、
そのチャンネルに属するメッセージ（社員の掛け合い）を **Slack 風のフラットなメッセージ一覧**として
表示する画面を実装する。

動作確認は **Storybook**（#9 で整備済み基盤）で行い、実 API（型共有パイプライン #8/#41）には依存せず、
画面を **props 駆動の presentational コンポーネント**として実装して fixture で描画・検証する。あわせて
**mdx の画面設計書**を Storybook に表示する。

データモデルは #27（Scene 廃止・message を channel に直接紐づけ）と整合し、common の `Message`
（`speaker` / `channel` / `text`）を単一情報源として用いる（ADR-0005）。

## 2. スコープ（やること / やらないこと）

### やること
- チャンネル詳細画面を `Message[]` + `Channel` + `Employee[]` を props で受け取る presentational
  コンポーネント `ChannelView` として実装（API・ルータ・グローバル状態に非依存）。
- speaker（Employee ID）→ 社員 `displayName` の解決（未解決時は ID フォールバック）。
- 空状態・チャンネルヘッダの表示。
- `ChannelScene`（ルート）を `ChannelView` へ fixture を渡す薄いコンテナとして接続。
- `*.stories.tsx`（通常 / 空状態）と mdx 画面設計書を Storybook に追加。
- presentational コンポーネントの RTL テスト、stories のスモークテスト。

### やらないこと（スコープ外）
- 実 API からのメッセージ取得（server エンドポイント / 型共有 #8/#41 / TanStack Query 連携）。
- 投稿・タスク表示・既読・無限スクロール等のインタラクション。
- 経験値・進化・関係値・キャラクター詳細（Phase 1 以降）。
- Storybook 基盤そのもの（#9）/ ドメインモデル変更そのもの（#27）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `ChannelView` は `channel: Channel` / `messages: readonly Message[]` / `employees?: readonly Employee[]`
   を props で受け取り、API・ルータ・グローバル状態に依存しない（fixture 描画できる）。
2. チャンネルヘッダとして `channel.label`（例 `#雑談`）を見出しとして表示する。
3. `messages` を Slack 風フラット一覧として表示し、各行に「発言者名 + 本文」を出す。
4. 発言者名は `speaker`（ID）→ `employees` の `displayName` に解決する。解決できない ID は ID をそのまま表示する。
5. `messages` が空のとき、空状態メッセージを表示する（一覧は描画しない）。
6. `employees` 未指定時は common の `DEFAULT_EMPLOYEES` を既定とする。
7. `ChannelScene` は `channelId` から対応する `Channel` を解決し（既定チャンネルになければ
   `#${id}` でフォールバック）、fixture の `messages` を `ChannelView` に渡す薄いコンテナである。
   既存のルーティング・サイドバー挙動を壊さない。
8. `ChannelView` の `*.stories.tsx` に「通常（複数発言・複数社員）」「空状態」のストーリーがある。
9. mdx 画面設計書が存在し、`Meta` で対象ストーリーに紐付く。
10. `turbo run lint test build` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **依存方向**: client → common の一方向のみ（ADR）。`ChannelView` は common の型
  （`Message` / `Channel` / `Employee` / `DEFAULT_EMPLOYEES`）を import する。server へは依存しない。
- **presentational / container 分離**:
  - `client/src/components/ChannelView.tsx` … presentational（props 駆動）。既存
    `EmployeeTable`（props + 既定値フォールバック）と同じ流儀。
  - `client/src/routes/ChannelScene.tsx` … container。`channelId` → `Channel` 解決 + fixture 注入。
- **speaker 解決**: `employees` から `id → displayName` の Map を構築し O(1) で解決。未解決は ID 表示。
- **fixture 共有**: `client/src/fixtures/channelMessages.ts` に既定チャンネルごとのサンプル
  `messages` を定義し、Story と `ChannelScene` が共有（DRY・単一情報源）。
- **Message に id が無い**ため、リストの React key は `speaker` + index の合成で安定化する。
- **UI**: MUI v6（Box / Typography / Stack）。Slack 風テーマ（既存 `theme.ts`）に従う。
  一覧は `aria-label="メッセージ一覧"`、ヘッダは見出し要素にしてアクセシブルにする。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client**（主）:
  - 追加: `components/ChannelView.tsx` / `components/ChannelView.stories.tsx` /
    `components/ChannelView.stories.test.ts` / `components/ChannelView.test.tsx` /
    `fixtures/channelMessages.ts`。
  - 変更: `routes/ChannelScene.tsx`（スタブ → `ChannelView` コンテナ）。
- **docs**: 追加 `src/channel-view.mdx`（画面設計書、`Meta of` でストーリー紐付け）。
- **common**: 変更なし（既存 `Message` / `Channel` / `Employee` を再利用）。
- **server**: 変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

- `client/src/components/ChannelView.test.tsx`（RTL）
  - 通常: 各メッセージの本文と、解決済み発言者名（displayName）が描画される。
  - speaker 解決: 既知 ID は displayName、未知 ID はそのまま表示される。
  - チャンネルヘッダ: `channel.label` が見出しとして描画される。
  - 空状態: `messages` が空のとき空状態メッセージが出て、一覧は描画されない。
  - 既定 employees: `employees` 省略時に `DEFAULT_EMPLOYEES` で解決される。
- `client/src/components/ChannelView.stories.test.ts`（スモーク）
  - `meta.component` が `ChannelView` を指す / `Default`・`Empty` ストーリーが export される。

## 7. リスク・未決事項

- `Message` に `id` が無いため key は合成キーで代替（将来 #39/#40 で id 追加時に差し替え）。
- fixture はあくまでプレースホルダ。実データ接続は #8/#41（型共有）と後続 MVP Issue で差し替える。
- mdx の `Meta of` 連携は Storybook 8 の autodocs 前提。基盤（#9）に準拠する。
