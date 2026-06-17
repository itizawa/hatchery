# 設計書: server の authorWorker ユーティリティのユニットテストを追加する (#650)

## 1. 目的 / 背景

`server/src/routes/authorWorker.ts` には post/comment レコードに `author_worker` を付与するユーティリティが実装されているが、テストが存在しない。
feeds・communities・posts ルートで使われる重要なエンリッチ処理であり、author 解決失敗時のフォールバック分岐が未テスト。

## 2. スコープ（やること / やらないこと）

やること:
- `server/src/routes/authorWorker.test.ts` を新規作成
- `attachAuthorWorker` / `buildAuthorWorkerEnricher` の各分岐をカバーするユニットテストを追加

やらないこと:
- ルートレベル（communities.test.ts 等）の統合テスト
- `common` の `buildAuthorWorkerResolver` のテスト（既に `authorWorker.test.ts` が存在）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `attachAuthorWorker`: author が解決できた場合、対応するレコードに `author_worker` が付与される
2. `attachAuthorWorker`: author が解決できない場合、`author_worker` なしでレコードが返る
3. `attachAuthorWorker`: 空配列を渡すと空配列が返る（N+1 回避のショートサーキット）
4. `buildAuthorWorkerEnricher`: 返された enricher が複数レコードを正しく付与する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `createInMemoryWorkerRepository` を使ってワーカーストアをスタブする（DB 不要）
- `HasAuthor` の最小型（`{ author: string }`）を持つオブジェクトで各テストを記述
- `author_worker` が付く場合と付かない場合の両分岐を明示的にアサート
- `buildAuthorWorkerEnricher` は async なので `await` で呼び出す

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- server ワークスペースのみ
- 新規ファイル: `server/src/routes/authorWorker.test.ts`
- 既存コードへの変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| テスト名 | 対象関数 | 検証内容 |
|---------|---------|----------|
| author が解決できた場合 author_worker が付与される | `attachAuthorWorker` | id で一致するワーカーが `author_worker` として埋め込まれる |
| author が解決できない場合 author_worker なしで返る | `attachAuthorWorker` | 解決不能な author は `author_worker` プロパティなしで返る |
| 空配列を渡すと空配列が返る | `attachAuthorWorker` | `records.length === 0` のショートサーキットが動く |
| enricher が複数レコードを正しく付与する | `buildAuthorWorkerEnricher` | 解決成功・失敗混在の複数レコードで正しく振り分けられる |

## 7. リスク・未決事項

特になし。`createInMemoryWorkerRepository` が利用可能なため、DB 接続なしでテスト可能。
