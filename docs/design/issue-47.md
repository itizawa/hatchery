# 設計書: チャンネル作成機能（POST /channels）と DEFAULT_CHANNELS の DB 移行 (#47)

## 1. 目的 / 背景

チャンネルは現在 `common/src/domain/channel/channel.ts` の `DEFAULT_CHANNELS` / `CHANNEL_IDS` としてハードコードされ、client（`ChannelList`）はこれを単一情報源として描画している。`Channel` モデル（Prisma）と `PATCH /channels/:id`（#37）は既にあるが、一覧取得・作成 API が無い。

本 Issue では **チャンネル一覧を DB から取得し、ログインユーザーが任意のチャンネルを作成できる**ようにする。client のハードコード参照を廃止し、`GET /channels` 経由に移行する。

## 2. スコープ（やること / やらないこと）

### やること

- server: `GET /channels`（認証不要）/ `POST /channels`（認証必須）を追加。
- server: `ChannelRepository` に `list()` / `create()` を追加し、InMemory 実装と新規 Prisma 実装を用意。`server.ts` で Prisma 実装を注入（現状 `channelRepository` 未注入で InMemory にフォールバックしていた）。
- common: `CreateChannelSchema`（POST ボディ検証）を追加。`DEFAULT_CHANNELS` は **seed 用の既定定義**として残し（acceptance の「seed 専用に移動」を採用）、client 実行時の一覧描画はやめる。
- client: `ChannelList` を `GET /channels`（TanStack Query）駆動に変更。`DEFAULT_CHANNELS` のハードコード参照を廃止。ログイン時のみ表示される「チャンネル追加」UI を追加。
- OpenAPI: `GET /channels` / `POST /channels` を registry に登録（型は client へ end-to-end に流れる）。

### やらないこと

- チャンネルタイプ（`zatsudan` / `task`）の付与は #54 のスコープ。
- チャンネル名の上限文字数（`.max()`）は #91 のスコープ。本 Issue は acceptance どおり「空文字 → 400」のみ。
- 認可・所有者モデルは対象外。
- `ChannelScene` の `findChannelById` フォールバック（表示名解決）は一覧機能ではないため据え置き。

## 3. 受け入れ条件（テストに落とせる粒度）

- AC1: `GET /channels`（認証不要）が `Channel[]` を 200 で返す。既定で seed 相当（zatsudan / shigoto）を含む。
- AC2: `POST /channels`（認証必須）で `{ label }` を送るとチャンネルが作成され 201 で `Channel`（生成 id + label）を返す。
- AC3: `POST /channels` を未ログインで呼ぶと 401。
- AC4: `label` が空文字の `POST /channels` は 400。
- AC5: `POST /channels` 後、`GET /channels` の一覧に作成チャンネルが含まれる。
- AC6: client `ChannelList` は `GET /channels` の結果を描画し、`DEFAULT_CHANNELS` を直接参照しない。
- AC7: client にログイン時のみ表示されるチャンネル追加 UI があり、未ログインでは表示されない。
- AC8: OpenAPI 定義に `GET /channels` / `POST /channels` が含まれ、client 型生成（`paths`）が通る（`build` 緑）。
- AC9: `pnpm turbo run lint test build` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **id 生成**: `Channel.id` は `@id`（DB 既定なし）。ユーザー作成チャンネルの id は `crypto.randomUUID()`（Node 組込み）でリポジトリ内生成し、**Prisma スキーマ変更・マイグレーションを不要**にする。既存 seed チャンネルは従来どおり明示 id（`zatsudan` / `shigoto`）。
- **層分離（ADR-0004）**: ルートは検証（`validateBody` + common Zod）と HTTP 変換のみ。永続化は `ChannelRepository` に委譲。`InMemoryChannelRepository`（テスト用・既定は DEFAULT_CHANNELS）と `PrismaChannelRepository`（本番）を実装。
- **境界（ADR-0001/0005）**: `CreateChannelSchema` は common（純粋 Zod）。client → common / server → common の一方向依存を維持。
- **型共有（ADR-0006）**: OpenAPI registry に経路を追加 → `openapi.json` → client `openapi-fetch` 型へ流れる。client は `openApiClient.GET/POST("/channels")` を使用。
- **client サーバ状態（ADR-0003）**: `useChannels()` / `useCreateChannel()` を `api/channels.ts` に追加し TanStack Query に集約。作成成功時に `["channels"]` を invalidate。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- common: `channel.ts`（`CreateChannelSchema` 追加・`DEFAULT_CHANNELS` の位置づけを seed 用に再記述）。
- server: `persistence/channelRepository.ts`（list/create 追加）、`persistence/prismaChannelRepository.ts`（新規）、`routes/channels.ts`（GET/POST 追加）、`openapi/registry.ts`（経路登録）、`server.ts`（Prisma 注入）。
- client: `api/channels.ts`（新規）、`components/ChannelList.tsx`（API 駆動化）、`components/AddChannelForm.tsx`（新規）、`routes/RootLayout.tsx`（追加 UI 配置）。`components/ChannelList.test.tsx`（API 駆動へ更新）。
- docs: 本設計書。

## 6. テスト計画（TDD で書くテスト一覧）

- common: `CreateChannelSchema` が空 label を reject / 正常 label を accept（`channel.test.ts` に追記）。
- server `routes/channels.test.ts`:
  - `GET /channels` が 200 で既定チャンネル配列を返す（AC1）。
  - `POST /channels` 未ログイン → 401（AC3）。
  - `POST /channels` 認証済み + `{label}` → 201 で生成チャンネルを返す（AC2）。
  - `POST /channels` 認証済み + 空 label → 400（AC4）。
  - 作成後 `GET /channels` に含まれる（AC5）。
- client:
  - `ChannelList.test.tsx`: `GET /channels` のモック応答（fetch スタブ）を QueryClientProvider 下で描画し、返ってきたラベルを表示（AC6）。
  - `AddChannelForm.test.tsx`: 未ログイン（/auth/me 401）で何も描画しない / ログイン時にフォームを描画（AC7）。

## 7. リスク・未決事項

- `server.ts` がこれまで `channelRepository` を注入しておらず PATCH /channels/:id は InMemory 上で動作していた（プロセス再起動で揮発）。本 Issue で Prisma 実装を注入し、永続化を一貫させる。
- `DEFAULT_CHANNELS` を完全削除すると seed / バッチ既定 / InMemory 既定 / Storybook が壊れるため、acceptance の「seed 専用に移動」を採用し定義は残す（client 実行時の直接参照のみ廃止）。
