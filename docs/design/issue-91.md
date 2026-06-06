# 設計書: チャンネル名（label）に入力上限を設け、ユーザー入力の上限文字数をルール化する (#91)

## 1. 目的 / 背景

`UpdateChannelSchema.label` は `z.string().min(1)` のみで上限が無く、任意の長さの文字列を受け付けてしまう。
表示崩れ・DB 負荷・不正データ防止のため上限 50 文字を設ける。
また、同種の問題を再発させないため「ユーザー入力フィールドには必ず Zod で上限を設ける」ルールを CLAUDE.md に明文化する。

## 2. スコープ（やること / やらないこと）

### やること

- `UpdateChannelSchema.label` に `.max(50)` を追加（PATCH /channels/:id の主要ターゲット）
- `ChannelSchema.label` にも `.max(50)` を追加（永続化・読み出し時の整合性）
- `CreateChannelSchema.label` にも `.max(50)` を追加（POST /channels の入力も同じ上限に揃える）
- `AddChannelForm.tsx` の TextField に `inputProps={{ maxLength: 50 }}` を追加（フロントでも二重防御）
- `CLAUDE.md` にユーザー入力の上限ルールを追記

### やらないこと

- 認可・所有者モデルの変更（#47 スコープ）
- 既存 DB データのマイグレーション（Zod 検証の変更のみ。スキーマ制約の追加は別途）
- チャンネル名の実際の変更 UI の新規作成（`PATCH /channels/:id` は既実装済み）

## 3. 受け入れ条件（テストに落とせる粒度で）

- `UpdateChannelSchema.label` は 51 文字以上で parse 失敗
- `UpdateChannelSchema.label` は 50 文字ちょうどで parse 成功
- `PATCH /channels/:id` に 51 文字の label を送ると 400 Bad Request
- `PATCH /channels/:id` に 50 文字ちょうどの label を送ると 200 OK
- `ChannelSchema.label` は 51 文字以上で parse 失敗
- `CreateChannelSchema.label` は 51 文字以上で parse 失敗
- `AddChannelForm.tsx` の TextField に `maxLength={50}` が設定されている
- `CLAUDE.md` にユーザー入力の上限ルールが追記されている

## 4. 設計方針

- 上限値は **50 文字**（Issue 指定値）。一覧表示や Slack 風 UI でのラベルとして十分な長さ。
- `common` の Zod スキーマを単一情報源として変更し、server 側の `validateBody(UpdateChannelSchema)` がそのまま 400 を返す（既存の `validateBody` ミドルウェアを変更しない）。
- OpenAPI レジストリは `UpdateChannelSchema` を参照しているため、`.max(50)` 追加で自動的に `openapi.json` に反映される。
- フロントは `inputProps={{ maxLength: 50 }}` で同じ上限を強制（ブラウザレベルの防御）。

## 5. 影響範囲

- **`common/`**: `channel.ts` の `UpdateChannelSchema`・`ChannelSchema`・`CreateChannelSchema`
- **`server/`**: テスト（`channels.test.ts`）のみ。ルーティング・リポジトリは変更なし。
- **`client/`**: `AddChannelForm.tsx` の TextField に `inputProps` 追加
- **`docs/`**: `CLAUDE.md` にルール追記

## 6. テスト計画

### `common/src/domain/channel/channel.test.ts`

- `UpdateChannelSchema`: label が 51 文字以上で失敗、50 文字で成功
- `ChannelSchema`: label が 51 文字以上で失敗
- `CreateChannelSchema`: label が 51 文字以上で失敗

### `server/src/routes/channels.test.ts`

- `PATCH /channels/:id`: 51 文字の label → 400
- `PATCH /channels/:id`: 50 文字ちょうどの label → 200

## 7. リスク・未決事項

- 既存 DB に 50 文字超のチャンネル名が入っている場合、読み出し時に `ChannelSchema.parse` が失敗する可能性がある。
  → 当リポジトリは MVP でシード起動なので既存データは既定の 3 チャンネル（数文字）のみ。リスクは無視できる。
