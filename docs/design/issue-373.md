# 設計書: バッチの getApiKey のユニットテストを追加する (#373)

## 1. 目的 / 背景

`server/src/utils/apiKey.ts` の `getApiKey` は定時バッチが Claude を呼ぶ際の API キー取得を担う重要経路だが、テストが存在しない。
DB 優先・復号失敗フォールバック・env フォールバック・undefined の 4 分岐を網羅するテストを追加し、リグレッションを防ぐ。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/utils/apiKey.test.ts` を新規追加
- `getApiKey` の全分岐をインメモリ依存注入・env スタブで検証
- TDD: まずテストを書き失敗確認 → コミット → 既存実装で緑化

**やらないこと:**
- `aiMessageGenerator.ts`（Claude SDK ラッパー）のテスト
- `appSettingRepository` の実 DB テスト
- `getApiKey` の実装変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. DB に `CLAUDE_API_KEY` が設定済みのとき、`decrypt` した平文を返す
2. `decrypt` が例外を投げたとき、`process.env.ANTHROPIC_API_KEY` のフォールバック値を返す（警告で握りつぶされること）
3. DB 未設定（`findByKey` が `null`）のとき、`process.env.ANTHROPIC_API_KEY` を返す
4. DB 未設定かつ env も未設定のとき、`undefined` を返す

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `createInMemoryAppSettingRepository` を使い DB 非依存でテスト
- `process.env.ANTHROPIC_API_KEY` は `afterEach` で復元する
- 復号失敗は不正な暗号文（`"invalid"` 等）を DB に入れることでシミュレート
- DB に正常値を入れる場合は `encrypt(plaintext)` で暗号化した値を設定する

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server/`
- 新規ファイル: `server/src/utils/apiKey.test.ts`
- 既存コードの変更: なし

## 6. テスト計画（TDD で書くテスト一覧）

1. `DB に CLAUDE_API_KEY が設定済みのとき、復号した値を返す`
2. `DB の CLAUDE_API_KEY が復号不能なとき、ANTHROPIC_API_KEY env を返す`
3. `DB に CLAUDE_API_KEY が設定されていないとき、ANTHROPIC_API_KEY env を返す`
4. `DB 未設定かつ env も未設定のとき、undefined を返す`

## 7. リスク・未決事項

- なし（実装は既存。テストを追加するだけ）
