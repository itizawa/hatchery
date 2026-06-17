# 設計書: server の authorWorker ユーティリティのユニットテストを追加する (#650)

## 1. 目的 / 背景

`server/src/routes/authorWorker.ts` には post/comment レコードに `author_worker` を付与するユーティリティが実装されていた。
Issue 起票時点ではテストが存在しなかったが、**関連 Issue #587 の対応として `server/src/routes/authorWorker.test.ts` が develop ブランチに先行実装済みであることを確認した**。
本 Issue に対しては受け入れ条件の確認と設計書の記録を行い、テスト実装済みとしてクローズする。

## 2. スコープ（やること / やらないこと）

やること:
- 設計書（本ファイル）の作成・受け入れ条件の確認

やらないこと:
- `server/src/routes/authorWorker.test.ts` の新規作成（Issue #587 で既に完了済み）
- ルートレベル（communities.test.ts 等）の統合テスト
- `common` の `buildAuthorWorkerResolver` のテスト（`common/src/domain/worker/authorWorker.test.ts` として既に存在）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `attachAuthorWorker`: author が解決できた場合、対応するレコードに `author_worker` が付与される
2. `attachAuthorWorker`: author が解決できない場合、`author_worker` なしでレコードが返る
3. `attachAuthorWorker`: 空配列を渡すと空配列が返る（N+1 回避のショートサーキット）
4. `buildAuthorWorkerEnricher`: 返された enricher が複数レコードを正しく付与する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `vi.fn()` による `makeRepo` インラインモックで `WorkerRepository` をスタブ（DB 不要）
- `HasAuthor` の最小型（`{ author: string }`）を持つオブジェクトで各テストを記述
- `author_worker` が付く場合と付かない場合の両分岐を明示的にアサート
- `buildAuthorWorkerEnricher`（非同期ファクトリ）を `await` で呼び出し、返された enricher（同期関数）を適用する

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- server ワークスペースのみ
- 既存ファイル（Issue #587 実装済み）: `server/src/routes/authorWorker.test.ts`
- 本 PR でのコード変更: なし（設計書追加のみ）

## 6. テスト一覧（Issue #587 で実装済みのテストと受け入れ条件との対応）

| テスト名 | 対象関数 | 対応する受け入れ条件 |
|---------|---------|----------|
| 空配列を渡すと [] を即返し、listBotWorkers は呼ばれない | `attachAuthorWorker` | 受け入れ条件 3（ショートサーキット） |
| author が id で一致するとき author_worker が付く | `attachAuthorWorker` | 受け入れ条件 1（author 解決成功） |
| author が displayName で一致するとき author_worker が付く | `attachAuthorWorker` | 受け入れ条件 1（displayName フォールバック） |
| 解決できない author のレコードには author_worker が付かない | `attachAuthorWorker` | 受け入れ条件 2（author 解決失敗） |
| imageUrl=null のワーカーは image_url=null になる | `attachAuthorWorker` | 受け入れ条件 1（image_url null 正規化） |
| 解決できる author と解決できない author が混在する配列を正しく処理する | `attachAuthorWorker` | 受け入れ条件 1+2（混在ケース） |
| 複数コレクションに enricher を適用しても listBotWorkers は 1 回だけ呼ばれる | `buildAuthorWorkerEnricher` | 受け入れ条件 4（enricher 再利用・N+1 回避） |

## 7. リスク・未決事項

特になし。テストは Issue #587 で既に実装済み。`vi.fn()` モックを使うため DB 接続不要でテスト可能。
