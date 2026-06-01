# 設計書: メッセージを作成できるようにする (#48)

## 1. 目的 / 背景

Hatchery の中核体験「AI社員の会話に人間が関与できる」ループを成立させるため、ログインユーザーがチャンネルにメッセージを投稿できるエンドポイントとUIを実装する。投稿されたメッセージはAIバッチ（#53）が参照し、会話の流れが変わることが期待される。

## 2. スコープ（やること / やらないこと）

### やること
- `POST /channels/:channelId/messages` APIエンドポイント（認証必須）
- `GET /channels/:channelId/messages` APIエンドポイント（認証不要）
- チャンネル詳細画面へのメッセージ入力フォーム追加
- fixture表示から実APIデータへの切り替え
- OpenAPIスキーマへの定義追加

### やらないこと
- ファイルアップロード
- メッセージの編集・削除
- リアルタイム更新（WebSocket等）
- チャンネル所属チェック（投稿者がチャンネルメンバーかの確認）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

### server
- [ ] 未ログインで `POST /channels/:channelId/messages` → 401
- [ ] `employeeId` なし（未紐づけ）のユーザーで POST → 400（EmployeeNotLinked）
- [ ] `employeeId` ありのユーザーで `text: "..."` → 201 + 作成メッセージ（id/speaker/channel/text含む）
- [ ] `text` が空文字 → 400
- [ ] 存在しないチャンネル ID → 404
- [ ] `GET /channels/:channelId/messages` → 200 + 配列（空含む）
- [ ] POST後にGETすると投稿メッセージが含まれる

### client
- [ ] 未ログイン時はメッセージ入力フォームが表示されない
- [ ] ログイン時はメッセージ入力フォームが表示される
- [ ] `text` が空の場合は送信ボタンが無効
- [ ] `text` がある場合は送信ボタンが有効

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### server

**新規スキーマ（common）**
`CreateChannelMessageSchema = { text: z.string().min(1).max(MAX_MESSAGE_LENGTH) }`
- リクエスト受け入れは `text` のみ。`speaker`/`channel` はサーバ側でセットする。

**ChannelRepository に `findById` を追加**
- `POST /channels/:channelId/messages` でチャンネル存在確認に使用。
- `list()` + filter より直接的な API。既存 InMemory 実装に追加。

**MessageRepository に `listByChannel` を追加**
- `GET /channels/:channelId/messages` のデータ取得。
- インメモリは records を filter してチャンネル絞り込み。

**ルートの追加（channels.ts）**
- `createChannelsRouter` に `MessageRepository` を追加（DI）
- `app.ts` から `deps.messageRepository` を渡す

**`req.user` の型**
- Passport の `deserializeUser` は `toAuthUser(user)` を返すので `req.user` は `AuthUser` 型。
- Issue #69（Passport req.user 型修正）は未完のため、ルートハンドラ内で `req.user as AuthUser` とキャストする。

### client

**useChannelMessages / usePostChannelMessage（channels.ts）**
- `GET /channels/{channelId}/messages` を openapi-fetch で呼び出し（type asertion を使用。gen-types でビルド後に型が確定）。
- `POST /channels/{channelId}/messages` で投稿し、成功後 `invalidateQueries` でメッセージ一覧を再取得。

**MessageInput コンポーネント（新規）**
- `onSubmit(text: string): void` / `disabled: boolean` props を受け取るシンプルな presentational。
- `text === ""` なら送信ボタン disabled。
- ログイン状態はコンテナ（ChannelScene）で判断し、未ログイン時はコンポーネントごと非表示。

**ChannelScene の更新**
- fixture → `useChannelMessages(channelId)` に切り替え（ローディング中は空表示）。
- `useAuth()` でログイン状態を取得し、ログイン時のみ `MessageInput` をレンダリング。

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `common/src/domain/message/message.ts` | `CreateChannelMessageSchema` 追加 |
| `server/src/persistence/channelRepository.ts` | `findById` メソッド追加 |
| `server/src/persistence/messageRepository.ts` | `listByChannel` メソッド追加 |
| `server/src/routes/channels.ts` | メッセージルート追加、`MessageRepository` DI |
| `server/src/app.ts` | `createChannelsRouter` 呼び出し更新 |
| `server/src/openapi/registry.ts` | 新エンドポイント登録 |
| `client/src/api/channels.ts` | `useChannelMessages` / `usePostChannelMessage` 追加 |
| `client/src/components/MessageInput.tsx` | 新規作成 |
| `client/src/routes/ChannelScene.tsx` | fixture → 実API、`MessageInput` 追加 |

## 6. テスト計画（TDDで書くテスト一覧）

### server（channels.test.ts に追加）
- `POST /channels/:channelId/messages` 未認証 → 401
- `POST /channels/:channelId/messages` employeeId なし → 400
- `POST /channels/:channelId/messages` 正常 → 201 + メッセージオブジェクト
- `POST /channels/:channelId/messages` text 空 → 400
- `POST /channels/:channelId/messages` 存在しないチャンネル → 404
- `GET /channels/:channelId/messages` 認証不要 → 200 + 空配列
- `GET /channels/:channelId/messages` POST後 → 200 + 作成メッセージ

### server（registry.test.ts に追加）
- `paths` に `/channels/{channelId}/messages` が含まれる

### client（MessageInput.test.tsx 新規）
- text空でボタン disabled
- text入力でボタン enabled
- 送信でonSubmit呼び出し

### client（ChannelScene.test.tsx 新規）
- 未ログイン時にメッセージ入力フォームが表示されない
- ログイン時にメッセージ入力フォームが表示される

## 7. リスク・未決事項

- Issue #69（req.user型修正）が未完のため、`req.user as AuthUser` のキャストを使用する（暫定）。
- `GET /channels/:channelId/messages` はチャンネル存在確認をしない（空配列を返すのみ）。存在しないチャンネルへの問い合わせを厳密にしたい場合は別Issueで対応。
- openapi.gen.ts は `pnpm gen-types` 実行後に型が確定する。CI の `build` タスクで自動生成されるため、テストは globalThis.fetch モックで代用する。
