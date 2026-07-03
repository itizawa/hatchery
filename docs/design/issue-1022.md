# 設計書: ニュースコミュニティの投稿タイトルにはてなブックマークの出典URLが露出する (#1022)

## 1. 目的 / 背景

#927（クローズ済み）でニュースコミュニティの**投稿本文（text）**にURL露出する問題を修正したが、
**投稿タイトル（title）** にも同種のURL露出が残存している。

本文の修正時に `buildCommunityPrompt.ts` の注意事項を「text フィールドおよびコメント本文に URL を含めないこと」と書いたが、`title` フィールドが対象外だった。

## 2. スコープ（やること / やらないこと）

### やること
1. `buildCommunityPrompt.ts` のURL禁止指示を `title` フィールドも対象に拡張する
2. `buildCommunityPrompt.test.ts` にタイトルURL禁止の検証テストを追加する
3. `persistBatchOutput.ts` でタイトルに URL が含まれる場合の簡易ログ警告を追加する（再発観測用）

### やらないこと
- 過去に生成済みデータのバックフィル
- タイトルのURL検出を強いバリデーション（生成失敗）にすること
- プロンプト以外の部分（fetchExternalFeed 等）の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `buildCommunityPrompt` が生成するプロンプトの注意事項行に `title` が含まれ、URLを禁止していること
2. 上記をユニットテストで検証すること
3. `persistBatchOutput` でタイトルに `http(s)://` パターンが含まれる場合、`logBatchInfo` で `persist_batch.title_url_detected` イベントをログ出力すること
4. 上記をユニットテストで検証すること
5. `pnpm turbo run build test lint` が緑であること

## 4. 設計方針

### `buildCommunityPrompt.ts` の変更

注意事項の URL 禁止行（L258 付近）を以下のように拡張する:

```
// Before
- 投稿本文（text フィールド）およびコメント本文（text）に URL（http または https から始まる文字列）を含めないこと

// After  
- 投稿タイトル（title フィールド）・投稿本文（text フィールド）およびコメント本文（text）に URL（http または https から始まる文字列）を含めないこと
```

### `persistBatchOutput.ts` の変更

`persistBatchOutput` 関数の冒頭で、生成された各 post の title を `URL_PATTERN = /https?:\/\//` でチェックし、
マッチした場合は `logBatchInfo("persist_batch.title_url_detected", { title })` でログ出力する（強いバリデーションはしない）。

## 5. 影響範囲 / 既存への変更

- `server/src/batch/buildCommunityPrompt.ts`: 注意事項の1行を修正
- `server/src/batch/buildCommunityPrompt.test.ts`: テスト1件追加
- `server/src/batch/persistBatchOutput.ts`: URL検出ログ処理を追加
- `server/src/batch/persistBatchOutput.test.ts`: テスト1件追加

ユーザー可視の振る舞いは変わらない（バッチプロンプト指示の変更・ログ追加のみ）。

## 6. テスト計画

### `buildCommunityPrompt.test.ts`
- `注意事項に投稿タイトル（title）も URL 禁止対象であることが含まれる（#1022）`: プロンプトのURL禁止行に `title` が含まれることを検証

### `persistBatchOutput.test.ts`
- `タイトルに URL が含まれる場合 persist_batch.title_url_detected をログ出力する（#1022）`: `vi.spyOn(logger, "logBatchInfo")` で呼び出しを確認

## 7. リスク・未決事項

なし。変更は最小限で後方互換性あり。
