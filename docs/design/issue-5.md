# 設計書: common パッケージ（ドメイン型・Zod スキーマ・純粋関数の土台） (#5)

## 1. 目的 / 背景

ADR-0005 に従い、client / server が共有するドメイン層の土台を `common/` に実装する。`common` は**実行環境非依存の純粋 TypeScript** パッケージで、ドメインモデル・型・ドメインロジック（純粋関数）・**Zod スキーマ**を置く。これにより「型・検証の単一情報源（single source of truth）」を common に確立し、client/server 間の不整合を防ぐ。

monorepo 基盤（#4/#12）はマージ済みで、`common/` には雛形 `add` 関数のみが入っている。本 Issue でこれを実体（MVP ドメインモデルと最初の純粋関数）に差し替える。client/server の実装より先に必要な土台。

対象スコープは `concept.md` の **MVP（最小 1 ループ）**: 社員 3 人・チャンネル 2 つ・定時 2 回、タスクは `new`→`done` の 2 状態のみ。経験値・進化イベント・関係値・mood などの拡張（Phase 1）は入れない。

## 2. スコープ（やること / やらないこと）

### やること

- `common/` に **Zod スキーマでドメインモデルを定義**（MVP: 社員 / チャンネル / シーン / メッセージ / タスク）。
- スキーマから **`z.infer` で型を導出してエクスポート**（型と検証を 1 つの定義から流す）。
- **ドメインロジックの純粋関数の土台**を用意し、少なくとも 1 関数を **TDD（テスト先行）** で実装する。本設計では以下 2 つを対象とする（いずれも UI/DB 非依存の純粋関数）:
  - `selectAppearingMembers`（登場メンバー選定 / 最終登場定時に基づくローテーション）
  - `formatRecentLog`（直近ログの整形・直近 N 件の切り出し）
- `common/src/index.ts` を整理し、スキーマ・型・純粋関数を公開 API として再エクスポートする。
- `common` パッケージに依存ライブラリ **`zod`** を追加する（環境非依存。ADR-0005 が許容する数少ない外部依存）。

### やらないこと（スコープ外）

- server / client からの利用実装（各 Issue）。
- **OpenAPI 生成 / zod-to-openapi 連携**（型共有パイプライン #8）。本 Issue は素の Zod スキーマまで。
- MVP の全ドメインロジック網羅。**シーン生成本体・プロンプト組み立て・要約パイプライン**は別 Issue。
- 経験値・進化イベント・関係値・mood・冪等性（slot_key 制約）・モデレーション等の Phase 1 要素。
- ESLint import 制約ルール自体の新規追加（#4 で導入済み。本 Issue は「違反しないこと」を担保するのみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

### A. スキーマと型

- A-1: `EmployeeSchema`・`ChannelSchema`・`MessageSchema`・`SceneSchema`・`TaskSchema` が `@hatchery/common` からエクスポートされている。
- A-2: 各スキーマに対応する型（`Employee`・`Channel`・`Message`・`Scene`・`Task`）が `z.infer` で導出され、エクスポートされている。
- A-3: `MessageSchema` は `speaker`（非空 string）・`channel`（非空 string）・`text`（非空・最大長 `MAX_MESSAGE_LENGTH`）を要求する。`text` が空文字、または最大長超過の入力は **parse に失敗**する。
- A-4: `SceneSchema` は `scene`（非空 string）と `messages`（**1 件以上**の `MessageSchema` 配列）を要求する。`messages` が空配列、または `scene` が空文字の入力は parse に失敗する。
- A-5: `TaskSchema` の `status` は **`new` / `done` の 2 値のみ**を許可する列挙であり、それ以外（例 `picked`・`dropped`・任意文字列）の入力は parse に失敗する。
- A-6: `concept.md`「出力フォーマット」例の JSON（`scene` + `messages` 4 件、speaker=`haru`/`mei`、channel=`zatsudan`/`shigoto`）が `SceneSchema.parse` を**通過**する。
- A-7: `ChannelSchema` は MVP の 2 チャンネル（`zatsudan` / `shigoto`）を表現でき、`id` と表示ラベルを持つ。チャンネル ID 定数（例 `CHANNEL_IDS`）がエクスポートされる。

### B. 純粋関数（TDD 対象 / 入出力で検証）

- B-1 `formatRecentLog(messages, n)`:
  - 入力 `messages`（`Message[]`）の**末尾 `n` 件**だけを対象に、各発言を 1 行のログ文字列（例 `[channel] speaker: text`）へ整形した配列を返す。
  - `messages.length <= n` のときは全件を返す。`n = 0` のときは空配列を返す。
  - **元配列を破壊しない**（呼び出し後も入力配列は不変）。
- B-2 `selectAppearingMembers(employees, count, lastAppearedBySlot)`:
  - 与えられた社員から、**最終登場が古い（または未登場の）社員を優先**して最大 `count` 名を選び、その `id` 配列を返す。
  - 候補数が `count` 以下なら全員返す。`count = 0` なら空配列。
  - 未登場（`lastAppearedBySlot` にエントリが無い）社員は最優先で選ばれる。
  - **同入力で結果が決定的**（純粋・副作用なし・入力非破壊）。

### C. 境界・品質

- C-1: `common` のソースは **React / MUI / DOM・Express / Prisma / Node 固有 API を import しない**。`pnpm --filter @hatchery/common lint`（および ルートの `pnpm lint`）が緑。
- C-2: `pnpm --filter @hatchery/common test`（Vitest）が**全緑**で、UI/DB を起動せず高速に完走する。
- C-3: `common` は他のアプリ固有ワークスペース（`@hatchery/client` / `@hatchery/server` / `@hatchery/docs`）に依存しない（ESLint の `no-restricted-imports` / `import/no-restricted-paths` で担保。違反すれば lint が落ちる）。
- C-4: `pnpm --filter @hatchery/common build`（`tsc -b`）が型エラーなく通る（strict / `verbatimModuleSyntax` 準拠）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4.1 ディレクトリ構成（common/src）

```
common/src/
  domain/
    channel.ts      # ChannelSchema, Channel, CHANNEL_IDS, 既定チャンネル定義
    employee.ts     # EmployeeSchema, Employee
    message.ts      # MessageSchema, Message, MAX_MESSAGE_LENGTH
    scene.ts        # SceneSchema, Scene（messages: Message[]）
    task.ts         # TaskSchema, Task, TaskStatus（new|done）
  logic/
    selectAppearingMembers.ts
    selectAppearingMembers.test.ts
    formatRecentLog.ts
    formatRecentLog.test.ts
  index.ts          # 上記を集約して再エクスポート（公開 API）
```

雛形の `index.ts` の `add` と `index.test.ts` は撤去し、上記の実体へ差し替える。

### 4.2 スキーマ設計（Zod / MVP 最小）

- **Channel**: `{ id: string; label: string }`。MVP の既定値は `zatsudan`（雑談）/ `shigoto`（仕事）。`CHANNEL_IDS = ["zatsudan", "shigoto"] as const` を定義し、`MessageSchema.channel` は当面この既知 ID 群と突き合わせ可能にする（厳密な enum 強制は #8 / シーン生成側の検証で行う余地を残し、common ではまず非空 string + 既知 ID 定数の提供にとどめる）。
- **Employee**: MVP に必要な最小限 — `id`（社員 ID）・`displayName`（表示名）・`role`（職種・任意）。キャラクター・バイブルの 5 層（語彙の井戸等）は Phase 1 のプロンプト設計 Issue に委ね、本 Issue では出さない（MVP スコープ厳守）。
- **Message**: `{ speaker: string; channel: string; text: string }`。`concept.md`「フィールド型定義」に準拠。`text` は非空かつ `MAX_MESSAGE_LENGTH`（定数。例 280）で上限。
- **Scene**: `{ scene: string; messages: Message[] }`。`messages` は `.min(1)`。`concept.md` の出力 JSON とフィールド名・構造を一致させる（後段の検証で生成 JSON をそのまま parse できる）。
- **Task**: `{ id: string; text: string; status: TaskStatus }`。`TaskStatus = z.enum(["new", "done"])`。MVP の 2 状態のみ（`picked`/`dropped` は Phase 1 なので入れない）。

> 補足（ADR-0006 整合 / forward-compat）: 型共有パイプライン（#8）では `zod-to-openapi` でこれらのスキーマから openapi.json を生成する。本 Issue では素の Zod に徹し、`.openapi()` 拡張・OpenAPI 関連の依存は #8 で追加する。スキーマは #8 が拡張しやすいよう 1 スキーマ 1 ファイルで疎に保つ。

### 4.3 純粋関数

- ドメインロジックは `common/logic` 配下に純粋関数として置く（ADR-0005: UI/DB 非依存・高速 TDD）。入力を破壊せず、同入力に対し決定的な出力を返す。
- `formatRecentLog`: 「直近 N 件の切り出し・ログ整形」。`concept.md`「ユーザーメッセージ（直近ログ）」と画面タイムライン整形の共通土台。
- `selectAppearingMembers`: 「登場メンバー選定」。`concept.md`「生成方式」のローテーション制御（最終登場定時が古い社員を優先）の純粋ロジック土台。実際の slot 採番・永続化は server 側（別 Issue）。

### 4.4 公開 API（index.ts）

`index.ts` は `domain/*` と `logic/*` を `export * from` で集約する。client/server は `@hatchery/common` から型・スキーマ・関数を import する（パッケージ名経由。ADR-0001 の依存方向に従う）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: **common**）

- **common**（唯一の変更対象）:
  - `common/package.json` に `dependencies: { "zod": "^3.x" }` を追加（pnpm-lock 更新）。
  - `common/src/index.ts` / `index.test.ts` の雛形（`add`）を撤去し、`domain/` `logic/` 構成へ差し替え。
  - `common/tsconfig.json` の `include`/`exclude` は現状（`src/**/*.ts`、テスト除外）で新ファイルも自動的に対象。変更不要の想定。
- **client / server / docs**: 変更なし（本 Issue では common を利用しない）。
- **ESLint / Turborepo / CI**: 設定変更なし。既存の import 境界ルール（#4）と CI（#13: `turbo run lint/test/build`）にそのまま乗る。

## 6. テスト計画（TDD で書くテスト一覧）

Vitest（`common/src/**/*.test.ts`）。受け入れ条件 §3 を入出力に落とす。**まずテストを書き → 失敗を確認 → コミット → 最小実装で緑**。

### スキーマ検証テスト（`domain/*.test.ts`）

1. `MessageSchema`: 正常な発言が parse 成功 / `text` が空文字で失敗 / `text` が最大長超過で失敗（A-3）。
2. `SceneSchema`: `messages` 1 件以上で成功 / 空配列で失敗 / `scene` 空文字で失敗（A-4）。
3. `SceneSchema`: `concept.md` の出力 JSON 例（4 メッセージ）が parse 成功し、`messages.length === 4`（A-6）。
4. `TaskSchema`: `status="new"` / `"done"` は成功 / `"picked"`・任意文字列は失敗（A-5）。
5. `ChannelSchema` / `CHANNEL_IDS`: `zatsudan`・`shigoto` を含み、Channel オブジェクトが parse 成功（A-7）。
6. 型エクスポートの存在確認（`z.infer` 型が import でき、最小オブジェクトに代入できる）（A-2。型レベルは tsc で担保、ランタイムは parse テストで間接確認）。

### 純粋関数テスト（`logic/*.test.ts`）

7. `formatRecentLog`: `n` 件超のとき末尾 `n` 件のみ整形 / `length <= n` で全件 / `n=0` で空配列 / 入力配列が不変（B-1）。
8. `selectAppearingMembers`: 古い登場順に最大 `count` 名 / 未登場が最優先 / 候補 <= count で全員 / `count=0` で空 / 入力非破壊・決定的（B-2）。

### 境界・ビルド（コマンドで確認、テストコードではない）

9. `pnpm --filter @hatchery/common lint` 緑（C-1・C-3）。
10. `pnpm --filter @hatchery/common build` 緑（C-4）。
11. `pnpm --filter @hatchery/common test` 全緑（C-2）。

## 7. リスク・未決事項

- **channel/speaker の厳密 enum 強制をどこまで common に持たせるか**: `concept.md` は「列挙／既知 ID に限定」を求めるが、社員 ID は会社設定で可変・channel も将来増える。本設計では common は「既知 ID 定数の提供 + 非空 string 検証」までとし、**既知 ID との突き合わせ（指定外社員の検出等）はシーン生成検証 Issue**で行う。MVP の固定 3 人/2ch なら enum でも可だが、拡張性を優先してこの線引きにした（レビューで判断を仰ぐ）。
- **`zod` のバージョン**: v3 系を採用（ADR-0006 の `zod-to-openapi` が安定対応する系列）。v4 採用可否は #8 と整合させる必要があり、本 Issue では v3 を既定とする。
- **Employee のフィールド粒度**: MVP 最小（id/displayName/role）に絞った。プロンプト用のキャラクター・バイブル詳細（語彙の井戸など）は別 Issue。ここで持ちすぎると MVP スコープを越えるため意図的に削っている。
- これらはいずれも設計内で MVP 寄りに倒して解決済み。受け入れ条件をテストに落とせない曖昧さは無いと判断する。
