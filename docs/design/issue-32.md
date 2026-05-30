# 設計書: server: 定時バッチ処理でメッセージ生成・投稿 (#32)

## 1. 目的 / 背景

Hatchery は「定時」に複数の Employee が会話するシーンを生成する（ADR-0009 で Scene は廃止し、message を
channel に直接紐づける方式）。本 Issue では **定時バッチ**を完成させる。

既存実装の現状（develop）:
- `server/src/batch/index.ts` … バッチ CLI エントリ（Express とは別プロセス）。**実装済み**
- `server/src/batch/runMessageBatch.ts` … 生成器を注入して永続化する本体 + `stubMessageGenerator`。**実装済み**
- `server/src/persistence/PrismaMessageRepository` … DB 永続化。**実装済み**

未実装の残作業（本 Issue で対応）:
1. **静的な発言テンプレート**（社員ごとの文字列リスト）と、そこから**複数 Employee をランダムに選んで**発言を組み立てる生成ロジック。現状の `stubMessageGenerator` は固定 2 件を返すだけ。
2. **1 日数回の「定時」実行をシミュレート可能なスケジューラ**（テストでモック可能）。現状の CLI は単発実行のみ。

MVP では Employee の発言は静的リストから選択する。AI API 生成への移行は別 Issue（#53）に委ねる。

## 2. スコープ（やること / やらないこと）

### やること
- common: 社員ごとの静的発言テンプレート `EMPLOYEE_MESSAGE_TEMPLATES` を定義（ADR-0005: 単一情報源）。
- common: 純粋関数 `selectRandomMembers` / `buildRosterMessages` を `logic/` に追加（rng 注入で決定的＝高速 TDD）。
- server: `createRosterMessageGenerator`（common のロジックを既定の社員・チャンネル・テンプレートで束ねる `MessageGenerator`）。
- server: スケジューラ `schedule.ts`（`msUntilNext` 純粋関数 + `SchedulerPort` 抽象 + `SystemScheduler` 既定実装 + `startMessageBatchScheduler`）。
- server: `batch/index.ts` を roster 生成器に切り替え、`--schedule` 引数でスケジューラ起動も可能にする。
- server: 公開 API の re-export 追加。

### やらないこと
- AI API による発言生成（#53）。本 Issue は静的リスト + `TODO` 留め。
- チャンネル所属に基づく発言候補の絞り込み（#33）。本 Issue は既定の全社員・全チャンネルを対象とする。
- 既存 `runMessageBatch` / `stubMessageGenerator` のシグネチャ変更（後方互換を保つ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `server/` に定時バッチ実行用の独立エントリポイント（`batch/index.ts`、Express 非 import）が存在する（既存・回帰で担保）。
2. 1 日数回の「定時」実行をシミュレートできる: `msUntilNext(hour, minute, now)` が現在時刻から次の発火までの正の ms を返し、`startMessageBatchScheduler` が指定時刻数だけジョブを登録する。
3. 各定時で**複数の Employee がランダムに選ばれ**（`selectRandomMembers` を rng 注入で検証）、**静的テンプレートから発言が選択される**（`buildRosterMessages`）。
4. 生成メッセージは `MessageSchema` を満たす（speaker / channel / text 非空・文字数上限内）。
5. 生成器 `createRosterMessageGenerator` の出力は既定で `DEFAULT_CHANNELS` の channel id・`DEFAULT_EMPLOYEES` の speaker のみを含む。
6. テストで定時実行をモックできる: `SchedulerPort` のフェイク実装を注入し、登録ハンドラを手動発火すると `runMessageBatch` が走りメッセージが永続化される。
7. 既存のバッチ挙動（`stubMessageGenerator` / `runMessageBatch` のカスタム生成器注入）が維持される（後方互換）。

## 4. 設計方針

- **層分離（ADR-0004）/ 依存方向 server → common（ADR-0005）**。発言組み立ての純粋ロジックは common に置き、server は「既定値の注入 + 永続化 + スケジューリング」の glue に徹する。
- **決定性のための rng 注入**: `buildRosterMessages` / `selectRandomMembers` は `rng: () => number`（既定 `Math.random`）を受け取り、テストは固定 rng で出力を検証する。
- **テスト容易なスケジューラ**: 時刻計算は純粋関数 `msUntilNext` に切り出して直接テスト。スケジューリング副作用は `SchedulerPort` に隔離し、フェイクで注入してタイマー無しでテストする。`SystemScheduler` は `setTimeout` + `msUntilNext` で次回発火し、発火後に翌日分を再登録する。
- **後方互換**: `runMessageBatch` / `stubMessageGenerator` は変更しない。`batch/index.ts` のみ既定生成器を roster に差し替える。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server / common）

- common（追加）: `src/constants/employeeMessages.ts`、`src/logic/buildRosterMessages.ts`、`src/index.ts` に re-export。
- server（追加）: `src/batch/rosterMessageGenerator.ts`、`src/batch/schedule.ts`。
- server（変更）: `src/batch/index.ts`（roster 生成器 + `--schedule`）、`src/index.ts`（re-export）。
- client への影響なし。

## 6. テスト計画（TDD で書くテスト一覧）

- common `constants/employeeMessages.test.ts`: `DEFAULT_EMPLOYEES` 全員のテンプレートが存在し、各文言が非空・`MAX_MESSAGE_LENGTH` 以内。
- common `logic/buildRosterMessages.test.ts`:
  - `selectRandomMembers`: 固定 rng で決定的・重複なし・count 超過時は全員・count<=0 で空・入力非破壊。
  - `buildRosterMessages`: 固定 rng で各チャンネルに perChannel 名分の発言、全件 `MessageSchema` 準拠、speaker/channel が入力由来。
- server `batch/rosterMessageGenerator.test.ts`: 既定で `DEFAULT_CHANNELS`/`DEFAULT_EMPLOYEES` のみ、固定 rng で安定、`runMessageBatch` に注入して永続化できる。
- server `batch/schedule.test.ts`: `msUntilNext` の境界（当日未来 / 当日過去→翌日 / ちょうど同時刻→翌日）、`startMessageBatchScheduler` が時刻数だけ登録、フェイク発火で `runMessageBatch` が走る。

## 7. リスク・未決事項

- 実 DB が無いため Prisma 経路は既存の skip 統合テストと型検査で担保（本番動作は実 DB 環境で別途）。
- `SystemScheduler` の実タイマー挙動はユニットでは検証せず、`msUntilNext`（純粋）+ フェイク Scheduler で論理を担保する（実タイマーテストは flaky なため避ける）。
- スケジュール時刻（既定 9/12/15/18 時）と発火頻度は #53（cron 1 日 4 回・AI 生成）で再調整される前提。本 Issue は静的 MVP。
