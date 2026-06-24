# 設計書: admin 画像アップロードルーターの multer 設定重複を共通ヘルパーに抽出する (#789)

## 1. 目的 / 背景

`adminWorkerImage.ts` と `adminCommunityImage.ts` は multer の設定（memoryStorage / fileFilter / limits）と
LIMIT_FILE_SIZE → 400 変換ミドルウェアを同一コードで重複している。
共通ヘルパーへ抽出し、保守性を向上させる。

## 2. スコープ（やること / やらないこと）

**やること**
- multer インスタンス生成（memoryStorage / fileFilter / limits）を共通ヘルパーに抽出
- `upload.single("image")` のラッパーミドルウェア（LIMIT_FILE_SIZE → 400 変換）を共通ヘルパーに抽出
- `adminWorkerImage.ts` と `adminCommunityImage.ts` が共通ヘルパーを使う形にリファクタ

**やらないこと**
- GCS 保存ロジック（StorageService）の変更
- クライアント側の変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `server/src/routes/imageUpload.ts` に multer インスタンス（`imageUpload`）と LIMIT_FILE_SIZE ハンドリングミドルウェア（`singleImageUpload`）を抽出する
2. `adminWorkerImage.ts` と `adminCommunityImage.ts` が `imageUpload.ts` から import する形に変わる
3. 既存の `adminWorkerImage.test.ts` の 6 テスト（未認証 401 / member 403 / 成功 200 / NotFound 404 / MIME 不正 400 / サイズ超過 400 / file 不在 400）が全て通る
4. 既存の `adminCommunityImage.test.ts` の `icon` / `cover` 各 6 テストが全て通る
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- `server/src/routes/imageUpload.ts` を新規作成
  - `imageUpload`: multer インスタンス（既存ルーターと同設定）
  - `singleImageUpload`: Express ミドルウェア。`imageUpload.single("image")` をラップし LIMIT_FILE_SIZE を 400 に変換
- 両ルーターから `upload` のローカル宣言を削除し、`imageUpload.ts` から import して置き換え
- `req.file` 不在時チェックはルーター内に残す（呼び出し元の文脈に依存するため）

## 5. 影響範囲

- `server/src/routes/imageUpload.ts`（新規）
- `server/src/routes/adminWorkerImage.ts`（変更）
- `server/src/routes/adminCommunityImage.ts`（変更）
- テストは変更なし（振る舞い不変）

## 6. テスト計画

既存テストで受け入れ条件をカバー済み。新規テスト追加は不要。
`adminWorkerImage.test.ts` と `adminCommunityImage.test.ts` を変更せずに全て緑にする。

## 7. リスク・未決事項

なし。純粋なリファクタであり振る舞いは変わらない。
