# 設計書: server/src/middleware/imageUpload.ts の singleImageUpload エラー分岐のテストを追加する (#1094)

## 1. 目的 / 背景

`server/src/middleware/imageUpload.ts` の `singleImageUpload` は (1) 正常アップロード成功、(2) `multer.MulterError` かつ `code === "LIMIT_FILE_SIZE"` の場合に 400 でエラーメッセージを返す、(3) それ以外のエラーは `next(err)` でエラーハンドラーに委譲する、という 3 分岐を持つミドルウェアだが、対応するテストが存在しない。ワーカー画像・コミュニティ画像アップロード（admin 画面）が利用する共通経路であり、壊れるとアップロード機能全体に影響するため、テストを追加してこの挙動を保証する。

## 2. スコープ（やること / やらないこと）

### やること
- `imageUpload.ts` の `fileFilter` を直接テストできる形に抽出する（挙動は変えない）。
- `fileFilter`（許可 MIME / 拒否 MIME）のテストを追加する。
- `singleImageUpload`（正常時 / LIMIT_FILE_SIZE エラー時 / その他エラー時）のテストを追加する。

### やらないこと
- `multer` 設定の重複解消（#789 で対応済みの共通ヘルパー化）は対象外。
- ルーティング層（`adminCommunityImage.ts` 等）の変更・テストは対象外。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `server/src/middleware/imageUpload.test.ts` を新設する。
2. `fileFilter`: `ALLOWED_IMAGE_MIME_TYPES` に含まれる MIME タイプ（例: `image/png`）では `callback(null, true)` が呼ばれる。
3. `fileFilter`: 含まれない MIME タイプ（例: `text/plain`）では `callback(null, false)` が呼ばれる。
4. `singleImageUpload`: 非 multipart なリクエスト（ファイル無し）では `next()` が呼ばれ、`res.status`/`res.json` へ書き込みが行われない。
5. `singleImageUpload`: `multer.MulterError`（`code: "LIMIT_FILE_SIZE"`、5MB 超のファイルを送信）が発生した場合、`res.status(400)` と `{ error: "FileTooLarge: image must be 5MB or less" }` が返り、後続の `next(err)` 経路（アプリのエラーハンドラー）には渡らないことを確認する。
6. `singleImageUpload`: `LIMIT_FILE_SIZE` 以外のエラー（`image` と異なるフィールド名でファイルを送信し `LIMIT_UNEXPECTED_FILE` を発生させる）では `next(err)` が呼ばれ、`res.status` が `singleImageUpload` 内で直接呼ばれないこと（後続のエラーハンドラーまで委譲されること）を確認する。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `imageFileFilter` という名前付き関数として `fileFilter` のロジックを `imageUpload.ts` からエクスポートし、`multer({ fileFilter: imageFileFilter, ... })` に渡す形に変更する（挙動は不変・単体テスト可能にするための抽出のみ）。第三引数がコールバックである multer の I/F 都合上、位置引数のまま維持し `CLAUDE.md` の関数引数規約の例外（コールバックパターン）に従う。
- `fileFilter` のテストは抽出した関数をモック `callback`（`vi.fn()`）で直接呼び出して検証する（`requireAdmin.test.ts` のモックオブジェクトパターンを踏襲）。
- `singleImageUpload` の正常系（AC4）は、非 multipart なプレーンリクエストオブジェクト（`content-type` ヘッダなし）+ モック `res`/`next` を渡して直接呼び出す（multer は non-multipart request を検知すると内部パースをスキップし即座に `next()` を呼ぶため、実際のストリーム parsing なしで検証可能）。
- `singleImageUpload` のエラー系（AC5, AC6）は、実際の multipart アップロードが必要なため `express` + `supertest` を使った統合テストとする（`errorHandler.test.ts` の `appThrowing` パターンを踏襲）。5MB 超のファイルは `Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1)` で生成する。フィールド名違いは `.field("image", ...)` ではなく `.attach("wrongField", buffer, "x.png")` で発生させる。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- 対象ワークスペース: **server** のみ。
- `server/src/middleware/imageUpload.ts`: `fileFilter` をエクスポート関数として抽出（挙動不変）。
- `server/src/middleware/imageUpload.test.ts`: 新設。
- client / common への変更なし。ユーザー可視の振る舞い変更なし（内部品質改善のみ）。

## 6. テスト計画（TDD で書くテスト一覧）

- `imageFileFilter` が許可 MIME で `callback(null, true)` を呼ぶ
- `imageFileFilter` が非許可 MIME で `callback(null, false)` を呼ぶ
- `singleImageUpload` が非multipartリクエストで `next()` のみ呼び、`res` に書き込みしない
- `singleImageUpload` が 5MB 超ファイルで 400 + `FileTooLarge` メッセージを返す
- `singleImageUpload` が想定外フィールド名エラーで `next(err)` に委譲する（後続ハンドラーまで到達する）

## 7. リスク・未決事項

- 5MB 超のバッファを都度生成するテストは実行時間・メモリをやや消費するが、既存の `MAX_IMAGE_SIZE_BYTES`（5 * 1024 * 1024）に対し + 1 バイトのみの超過で十分再現できるため許容範囲とする。
- 本 Issue はユーザー可視の振る舞いを変更しないため、e2e usecases の更新は不要と判断する。
