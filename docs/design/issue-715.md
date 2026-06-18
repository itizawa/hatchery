# 設計書: buildCommunityPrompt.ts のワーカー ID 表示ラベルを修正し LLM が author に UUID を使うよう誘導する (#715)

## 1. 目的 / 背景

`server/src/batch/buildCommunityPrompt.ts` で LLM に渡すプロンプト内のワーカー一覧において、`author` フィールドへの指定値が「workerId（上記ワーカー一覧のIDから選択）」と表示されていた。この説明では LLM がワーカーの `displayName`（例: "haru"）を `author` に使う可能性があり、実際に名前ベースの author 値が生成されてしまう問題が報告されている。

`runCommunityBatch.ts` の author 解決ロジック（`buildAuthorWorkerResolver`）は id→displayName 両方を照合するが、UUID 形式の id を正しく指定させる誘導がプロンプト上で不十分だった。

## 2. スコープ（やること / やらないこと）

**やること:**
- `buildCommunityPrompt.ts` のワーカー一覧 ID ラベルを UUID 指定であることが明確な表現に変更
- ワーカー一覧の名前ラベルを「参考・author には使わない」と明示する表現に変更
- JSON 例示の `author` フィールドを UUID 形式の指定であることが明確な表現に変更
- 既存Post返信（replies）の `author` フィールドも同様に修正
- 注意事項の `author` 説明を UUID 指定であることが明確な表現に変更

**やらないこと:**
- `aiMessageGenerator.ts` の JSON バリデーション・author 解決ロジック自体の変更
- `runCommunityBatch.ts` の `buildAuthorWorkerResolver` ロジックの変更
- バッチリトライ (#626) 関連の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. プロンプト内のワーカー一覧で ID ラベルが「author に指定するID（UUID）」を含む
2. プロンプト内のワーカー一覧で名前ラベルが「名前（参考・author には使わない）」を含む
3. プロンプト内の JSON 例示の `author` フィールドが「UUID（上記ワーカー一覧の「author に指定するID」から選択」を含む
4. プロンプト内の注意事項に「UUID」の文言が含まれる（author は UUID を使うべきという誘導）
5. 既存の全テストがグリーンであること
6. `pnpm --filter @hatchery/server test` が全件グリーン
7. `pnpm turbo run build lint` がグリーン

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 変更対象は `buildCommunityPrompt.ts` のプロンプトテンプレート文字列のみ
- `WorkerDef` インターフェースや関数シグネチャは変更しない
- ワーカー一覧（`workerLines`）の各行フォーマットを変更する
- JSON 例示（`"author": "workerId（...）"`）のテキストを変更する
- 注意事項（`- author には必ず上記ワーカー一覧の ID を使用してください`）を UUID 指定を強調する文言に変更

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

- `server/src/batch/buildCommunityPrompt.ts` — プロンプトテンプレートのラベル変更
- `server/src/batch/buildCommunityPrompt.test.ts` — 新規テスト追加（既存テストは変更しない）

## 6. テスト計画（TDDで書くテスト一覧）

新規追加するテスト（`describe("UUID誘導ラベル（#715）")`）:

1. ワーカー一覧の ID ラベルに「author に指定するID（UUID）」が含まれることを確認
2. ワーカー一覧の名前ラベルに「名前（参考・author には使わない）」が含まれることを確認
3. JSON 例示の author フィールドに「UUID」が含まれることを確認
4. 注意事項に「UUID」が含まれることを確認

## 7. リスク・未決事項

- リスク: 既存テストのうち worker ID として "haru", "ken" のような非 UUID 文字列を使っているものがある。ID ラベルの表示文字列は変わるが、実際の ID 値は変わらないため既存テストへの影響はない。
- 未決: 将来的に LLM 側の author 解決をより堅牢にするためのバリデーション強化（#626 等）は本 Issue のスコープ外。
