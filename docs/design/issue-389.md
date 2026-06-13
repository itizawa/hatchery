# 設計書: Issue #389 定時バッチのシーン生成コストを削減する

- 関連 Issue: #389
- 関連 ADR: ADR-0009（1 community = 1 API コール）, ADR-0019 / ADR-0020（生成モデル）, ADR-0023（生成エンジンは @anthropic-ai/sdk 単発コールのみ）, **ADR-0030（vote 重み付きで 1 定時 = 1 コミュニティのみ生成）**
- 関連 Issue（依存/関連）: #388（定時自動実行の配線）, #153 / #75（使用量・実行ログ）, #486（ADR-0030 の実装）

## 背景と前提の更新（重要）

Issue #389 起票時の前提は ADR-0009「1 定時で **全 community** を生成（community ごと 1 API コール）」だった。しかし本 Issue と同日に Accepted となった **ADR-0030（#486）が、定時方式を「vote 重み付きランダムで選んだ 1 コミュニティだけを生成する」へ変更**した。実装上、`runCommunityBatch` は `selectOneCommunity` で **1 定時 = 最大 1 回の Claude API コール**になっている（コミュニティ数に非依存）。

この前提変更は本 Issue の各施策の費用対効果を次のように変える:

- **Batches API（AC3）**: 「定時 1 回分の全 community をまとめて 1 バッチで投げる」という当初の主目的（複数リクエストの束ね）が消滅した。1 定時で投げるリクエストは常に 1 件であり、束ねる対象がない。Batches API は全トークン 50% オフだがリクエスト完了まで最大 24h のポーリングを要し、#388（外部トリガのタイムアウト設計）と整合させにくい。
- **プロンプトキャッシュ（AC4）**: 「1 回の実行内で複数 community が共有する安定 prefix」がキャッシュ発火対象だったが、1 定時 = 1 community となったため **同一実行内で prefix を共有する相手がいない**。さらに定時実行は TTL（5 分 / 1 時間）を跨ぐため、実行間でもキャッシュは効かない。

この設計はこの前提変更を踏まえ、**確実にコスト/挙動を改善できる AC1・AC2 を本丸として実装**し、AC3・AC4 は「効果測定の上で採否を判断し設計書に記録する」という AC の要件どおり、計測根拠を添えて採否を決める（Issue 本文の「規模が大きくなりすぎる場合は ③/④ を別 Issue に分割してよい」に従う）。

## 受け入れ条件への対応方針

### AC1: モデル選定の設定化（採用・実装）

- 環境変数 `BATCH_MODEL` を新設。許可値は Zod `.enum(["claude-sonnet-4-6", "claude-haiku-4-5"])`、既定 `claude-sonnet-4-6`。不正値は **起動時 ZodError**（`loadEnv` の既存方針と整合：不正な env は parse 時に throw して起動時に気付ける）。
- `BATCH_MODEL` を共通定数として `common` ではなく **server 側 `config/env.ts`** に置く（env 読み出しは server の責務。許可値の Zod enum も env スキーマ内で完結する）。`ServerEnv.batchModel: BatchModel` を追加。
- 生成側: `aiMessageGenerator` のハードコード `MODEL` を排し、**モデルを引数に取るファクトリ** `createClaudeConversationGenerator(model)` を追加。`generateConversationWithClaude` は既定（sonnet-4-6）のまま後方互換に残す（既存テスト・DI 署名 `(prompt, apiKey) => Promise<string>` を壊さない）。
- 配線: `communityBatchIndex` の `main()` で `env.batchModel` から生成関数を作り `runCommunityBatch` の `generate` に注入。
- テスト: 「`BATCH_MODEL` に応じて `messages.create` に渡る `model` が変わる」「不正値は弾かれる」「未設定は既定 sonnet」を担保。

許可値に haiku-4-5（\$1/\$5、sonnet の入力 1/3・出力 1/3）を含めることで、品質許容なら 1 行の env でコスト 1/3 に落とせる。

### AC2: 直近ログ件数の設定化（採用・実装）

- 環境変数 `BATCH_RECENT_LIMIT` を新設。Zod `.coerce.number().int().min(1).max(50)`、既定 30（現行 `DEFAULT_RECENT_LIMIT`）。下限 1・上限 50 で検証（Issue 例どおり）。
- `ServerEnv.batchRecentLimit: number` を追加し、`communityBatchIndex.main()` で `runCommunityBatch` の `recentLimit` に渡す。
- `DEFAULT_RECENT_LIMIT` は `runCommunityBatch` の既定として残し（注入が無い場合のフォールバック）、env の既定値も同じ 30 を `config/env.ts` 側に定数 `DEFAULT_BATCH_RECENT_LIMIT` として持つ。
- テスト: 「env で指定した件数が `postRepo.listByCommunity` / `formatRecentLog` の上限に反映される」を担保。直近ログを減らせば入力トークンが減りコストが下がる。

### AC4: プロンプトキャッシュの評価と適用（構造化は採用・`cache_control` は不採用、理由を記録）

- `buildCommunityPrompt` を「**安定 prefix**（指示文 + トーン規約 + ワーカー定義 + 作風 description/synopsis）→ **可変 suffix**（直近ログ）→ 出力フォーマット指示」の順に整理し、安定部が前・可変部が後ろに来るよう構造化する。これはキャッシュの有無に関わらずプロンプトの可読性・将来のキャッシュ適用余地のために有益。
- **`cache_control` は付与しない（不採用）**。理由:
  1. **prefix の最小トークン**: sonnet-4-6 のキャッシュ最小 prefix は **2048 トークン**。本プロンプトの安定部（指示文 + トーン規約 + ワーカー 3 人 + 作風）は数百トークン規模で 2048 に遠く満たず、`cache_control` を付けても**サイレントに発火しない**（`cache_creation_input_tokens: 0`）。書き込みプレミアム（1.25×）だけ payが発生し read が 0 になる純損。
  2. **共有相手の不在（ADR-0030）**: 1 定時 = 1 community のため、同一実行内で同じ prefix を読む 2 件目以降のリクエストが存在しない。キャッシュは「2 回目以降の read」で初めて元が取れるが、その 2 回目が無い。
  3. **TTL 跨ぎ**: 定時実行は数時間おき。5 分 / 1 時間 TTL を必ず跨ぐため、実行間でもキャッシュは生存しない。
- 将来、コミュニティあたりのワーカー数や作風が大きく増えて安定部が 2048 トークンを超え、かつ 1 定時で複数 community を生成する方式へ戻る（ADR-0030 の再々検討）場合は、構造化済みなので `cache_control` を安定部末尾に 1 つ付けるだけで適用できる。その判断材料（安定部トークン数）は `count_tokens` で計測可能な形にしておく。

### AC3: Batches API（path は実装しテスト可能にするが、既定経路にはしない）

- AC3 の文言は「Batches API で投げ、完了をポーリングして検証・永続化する**経路を実装**」「生成関数は依存注入のスタブで**テスト可能**にする（実 API を叩かない）」。前提変更により Batches を**既定にする合理性は失われた**が、AC の要件（経路の実装 + DI でのテスト可能性）を満たすため、**opt-in の薄いヘルパー** `generateConversationWithClaudeBatch`（= Batches API 経由で 1 リクエストを投げ完了までポーリングし最初のテキストを返す `ConversationGenerator`）を `aiMessageGenerator` に追加する。
  - `messages.batches.create({ requests: [{ custom_id, params }] })` → `retrieve` で `processing_status === "ended"` までポーリング → `results` から `custom_id` 一致の `succeeded` を取り出しテキストを返す。`custom_id` に community を対応づけられる形（引数で受ける）にする。
  - 既存の検証（`GenerationOutputSchema` / `validateGenerationOutput`）と `slot_key` 永続化は `runCommunityBatch` 側で**そのまま再利用**される（`generate` が同じ `(prompt, apiKey) => Promise<string>` 署名を満たすため、差し替えるだけでよい）。
  - **テスト**: Anthropic クライアント・スリープを DI seam（`deps`）で注入し、`batches.create/retrieve/results` のスタブで「create→ポーリング→結果取得→テキスト返却」「`custom_id` 不一致や `errored` の扱い」を実 API を叩かず検証する。
- **既定経路は同期 `messages.create`**（現状維持）。Batches は 1 定時 = 1 リクエストでは即時性を犠牲にする割にコスト面の旨味（束ね）が出ないため、配線（`communityBatchIndex` の既定）には組み込まない。Batches を有効化する配線・#388 のタイムアウト整合は別 Issue（フォローアップ）とする。設計書にこの採否理由を記録（= AC3/AC4 の「採否と理由を設計書に記録」を満たす）。

## 変更ファイル

- `server/src/config/env.ts` — `BATCH_MODEL`（enum）, `BATCH_RECENT_LIMIT`（1..50）を追加。`ServerEnv` に `batchModel` / `batchRecentLimit`。許可モデル定数 `ALLOWED_BATCH_MODELS`・既定値を公開。
- `server/src/batch/aiMessageGenerator.ts` — モデル引数を取る `createClaudeConversationGenerator(model)`、Batches 経路 `createBatchConversationGenerator(deps)`（DI 可能）を追加。`generateConversationWithClaude` は sonnet 既定として維持。
- `server/src/batch/communityBatchIndex.ts` — `env.batchModel` から生成関数を作り、`env.batchRecentLimit` を `recentLimit` に渡す配線。
- `server/src/batch/buildCommunityPrompt.ts` — 安定 prefix → 可変 suffix の順に構造化（出力は意味的に等価）。
- テスト: `config/env.test.ts`, `batch/aiMessageGenerator.test.ts`, `batch/communityBatchIndex.test.ts`, `batch/buildCommunityPrompt.test.ts` を更新/追加。

## import 境界

すべて server 内に閉じる。`common` の `GenerationOutputSchema` / `validateGenerationOutput` / `formatRecentLog` は既存どおり利用（server → common の一方向のみ）。client への影響なし。

## ユーザー可視の振る舞い

無し（バックエンドの生成エンジン内部・env 設定のみ）。画面・遷移・表示は不変のため `e2e/` ユースケースの更新は不要。
