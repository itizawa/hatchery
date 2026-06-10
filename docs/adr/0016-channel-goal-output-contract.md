# ADR-0016: チャンネル goal（出力契約）の導入

- ステータス: Superseded by [ADR-0023](./0023-simplify-to-pure-conversation-observation.md)（成果物生成の廃止）
- 日付: 2026-06-09
- 関連 Issue: #284

## コンテキスト（背景）

現状、チャンネルの AI 振る舞いは `ChannelType`（enum: `zatsudan` / `task` / `planning`）にバッチ処理がハードコードで紐づく構造になっている。

- `zatsudan` → `runAiMessageBatch`（AI 社員の会話＝**発言**を生成）
- `planning` → `runPlanningBatch`（自社ページを巡回して **UX 改善提案**を生成）
- `task` → 現状バッチ処理なし

新しい AI の振る舞いを追加するたびに「enum 値の追加 + 専用バッチの追加 + dispatch のハードコード分岐」が必要で拡張性が低い。これを解消するため、チャンネルが「**何を出力するか（出力契約）**」をデータとして宣言する `goal` フィールドを導入する。

## 決定

チャンネルに `goal`（出力契約）フィールドを追加し、バッチ dispatch を goal 駆動に一般化する。

具体的には以下のとおり決定する:

**(a) goal 概念の導入**
- `ChannelGoalType`: `chat`（発言生成）| `issue`（GitHub Issue 起票）
- `ChannelGoal`: `{ type: ChannelGoalType, instructions?: string }` — 出力種別 + 任意の指示文
- `instructions` は将来拡張用（バッチプロンプトへの追加指示）。文字数上限は 500 文字。

**(b) 出力種別の初期集合**
- `chat`: AI 社員の掛け合い会話を生成（既存 `runAiMessageBatch` に相当）
- `issue`: ページを巡回して UX 改善点を GitHub Issue に起票（既存 `runPlanningBatch` に相当）
- 将来拡張: Slack 通知・外部リサーチ等を追加できる（ハードコード不要）

**(c) 既存 `type` との関係と後方互換方針**
- `type` は**表示カテゴリ**（zatsudan/task/planning）として DB に残す。AI 振る舞いとは独立した概念とする。
- `goal` が AI 振る舞いの決定要素となり、dispatch は `goal.type` のみを参照する（`type` を参照しない）。
- デフォルト mapping（移行時の変換）:
  - `zatsudan` / `task` → `goal.type = chat`
  - `planning` → `goal.type = issue`
- `type` の完全廃止は将来の別 ADR で判断する（現時点では backward compat のため残す）。
- `CreateChannelSchema` の `type` フィールドは残すが、新規チャンネルでは `goal` が主たる設定項目となる。

## 理由

- goal を「出力契約」としてデータで宣言することで、新しい AI 振る舞いを**コード変更なく**設定できる拡張性が生まれる。
- `type` を残すことで既存 API・既存データ・テストへの破壊的変更を避けられる。
- 「独立した概念」とすることで将来 `zatsudan` タイプのチャンネルに `issue` goal を設定する等の柔軟性が確保できる。
- `instructions` フィールドを宣言しておくことで将来のプロンプト制御に備える。

## 検討した代替案

- **案A: `type` を廃止して `goal` に一本化**: クリーンだが、既存 API 利用者・既存データ・多数のコードへの変更が大きく、破壊的。今回のスコープ（等価性維持）と合わない。
- **案B: `type` に新値（`chat`/`issue`）を追加**: `type` の意味（表示カテゴリ vs AI 振る舞い）が混在する。enum 追加のたびに概念が膨らむ。
- **採用案（型を並存）**: `type`（表示カテゴリ）と `goal`（AI 振る舞い）を独立した概念として分離することで、将来の拡張性と今回の破壊的変更回避を両立する。

## 影響（結果）

- 良い影響:
  - バッチ dispatch が goal 駆動になり、新しい AI 振る舞いの追加が「DB の goal 値の追加＋バッチハンドラの追加」だけで完結する
  - `runPlanningBatch` がハードコード channel ID（"kikaku"）依存から解放され、任意の goal=issue チャンネルに汎用化される
  - `instructions` フィールドによる将来のプロンプト制御への道が開く
- トレードオフ / 注意点:
  - `Channel` ドメイン型に `goal` が追加され、既存の `DEFAULT_CHANNELS` / seed / テストデータに goal を付与する必要がある
  - Prisma マイグレーションが必要（goalType / goalInstructions カラム追加 + 既存行の変換）
  - `type` と `goal` が並存する遷移期間中の概念の重複
- フォローアップが必要なこと:
  - 将来の `type` 廃止（新規 ADR で判断）
  - `instructions` の UI 編集機能（別 Issue）
  - `goal=issue` での Claude Agent SDK 採用（#287）
