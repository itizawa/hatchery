# 設計書: Message データモデル確定・common で Zod スキーマ定義 (#40)

## 1. 目的 / 背景

#27（Scene 廃止）以降、message は channel に直接紐づくフラットな構造になった。生成ペイロードとしての
`MessageSchema`（`speaker` / `channel` / `text`）は common に既に存在し、server / client から単一情報源として
使われている（`MessageArraySchema`・openapi 登録・client `ChannelView` の `readonly Message[]` など）。

一方で「**永続化された** message」の形（`id` / `createdAt` / `order` を加えたもの）は、現状 server の
`MessageRecord` インターフェース（`server/src/persistence/messageRepository.ts`）と Prisma スキーマの
`Message` モデルとで**独立に二重定義**されている。これは #40 が防ごうとした「各ワークスペースで独立して
定義されるリスク」そのものである。

本 Issue では、永続化済み message の形を **common に単一情報源として定義**し（`MessageRecordSchema` /
`MessageRecord`）、server の `MessageRecord` をそこから導出（再エクスポート）する。これにより ADR-0005
（common が型・スキーマの単一情報源）に従う。

## 2. スコープ（やること / やらないこと）

### やること
- common に **`MessageRecordSchema`**（= `MessageSchema` に `id` / `createdAt` / `order` を追加した永続化形）と
  `MessageRecord` 型（`z.infer`）を追加し、`index.ts` 経由でエクスポート。
- server の `MessageRecord` を common の型から再エクスポートに置き換え（独立定義を解消＝単一情報源化）。
- common にバリデーションテスト（正常系・異常系）を追加（TDD）。

### やらないこと
- 生成ペイロード `MessageSchema`（`speaker`/`channel`/`text`）の変更。`id` は永続化由来のため生成入力には
  含めない（AI 生成・`validateBody`・openapi リクエストを壊さないため、`id` 必須化は永続化形 `MessageRecordSchema`
  側で満たす）。
- Prisma スキーマ自体の変更（既に `id`/`speaker`/`channel`/`text`/`createdAt`/`order` で整合済み。整合の確認のみ）。
- OpenAPI 生成・client の API 連携本実装・フルテキスト検索等。

## 3. 受け入れ条件（テストに落とせる粒度）
- `MessageRecordSchema` が `{ id, speaker, channel, text, createdAt(Date), order(int>=0) }` を持つ正常入力を parse できる。
- `id` 欠損で parse 失敗する。
- `createdAt` が Date でない（文字列等）と parse 失敗する。
- `order` が負数・非整数だと parse 失敗する。
- `text` が空 / `MAX_MESSAGE_LENGTH` 超で parse 失敗する（`MessageSchema` の制約を継承）。
- `order = 0` の境界が parse 成功する。
- `MessageRecord` / `MessageRecordSchema` が `@hatchery/common` の公開 API（`index.ts`）から参照できる。
- server の `MessageRecord` が common 由来になり（型の単一情報源化）、既存の server テストが緑のまま（shape 不変）。
- `turbo run lint test build` が緑。

## 4. 設計方針
- `MessageRecordSchema = MessageSchema.extend({ id, createdAt, order })`。生成形（`Message`）を基底に永続化由来の
  3 フィールドを足すことで、生成形と永続化形の関係を型で表現する。
- `id`: `z.string().min(1)`。`createdAt`: `z.date()`（`Date` を推論し server の `createdAt: Date` と一致）。
  `order`: `z.number().int().nonnegative()`（バッチ内の発言順、0 始まり）。
- server `messageRepository.ts` は `import type { MessageRecord } from "@hatchery/common"` + `export type { MessageRecord }`
  に置換。shape が同一のため `InMemoryMessageRepository` / `PrismaMessageRepository` / usecases は無変更で通る。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）
- **common**: `domain/message/message.ts`（追加）、`domain/message/message.test.ts`（テスト追加）。`index.ts` は
  `export * from "./domain/message/index.js"` 済みのため自動公開。
- **server**: `persistence/messageRepository.ts`（`MessageRecord` を common 由来へ）。
- **client**: 変更なし（既に `Message` を common から import 済み＝当該 AC は充足済み）。
- **docs**: 本設計書。

## 6. テスト計画（TDD で書くテスト一覧）
`common/src/domain/message/message.test.ts` に `MessageRecordSchema` の describe を追加:
- 正常系: 完全な record / `order=0` 境界 / ちょうど `MAX_MESSAGE_LENGTH` の text。
- 異常系: `id` 欠損 / `createdAt` が文字列 / `order` 負数 / `order` 非整数。
公開 API 参照は既存 `index.test.ts` 系の方針に合わせ、common の index から参照可能なことを確認。

## 7. リスク・未決事項
- 生成形（`Message`）と永続化形（`MessageRecord`）を分けたままにする設計判断。#40 本文は単一 `MessageSchema` に
  `id` 必須を求めるが、`id` を生成入力に必須化すると AI 生成・リクエスト検証・openapi を破壊する。よって本文の意図
  （単一情報源化・`id` をモデルに持たせる）を、生成形を壊さない形で「永続化形を common に定義」する形で満たす。
- `order` の 0 始まり前提（`InMemoryMessageRepository` / `PrismaMessageRepository` の `index` 由来）を踏襲。
