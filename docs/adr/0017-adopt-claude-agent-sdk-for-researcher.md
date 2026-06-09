# ADR-0017: goal=issue リサーチャーエンジンへの Claude Agent SDK 採用（ADR-0004 増補）

- ステータス: Accepted
- 日付: 2026-06-09
- 関連 Issue: #287

## コンテキスト（背景）

`goal=issue`（リサーチャー）バッチ（ADR-0016）は、Web ページ巡回・調査結果の分析・GitHub Issue 自律起票を**ツール使用ループ**で実行するエージェント的ワークロードである。

現状のバッチ（`server/src/batch/planningBatch.ts`）は `@anthropic-ai/sdk` を直接呼び出す単発コール方式で実装されており、ツールループを手書きする必要があって自律性・拡張性が乏しい。

`@anthropic-ai/claude-agent-sdk` はこのユースケースに適合する:

- ヘッドレス実行が可能（`permissionMode: "dontAsk"`）
- `WebSearch` / `WebFetch` / MCP（GitHub 等）を標準ツールとして提供
- `maxTurns` と `max_budget_usd` でコスト・ターン数を上限管理できる
- Cloud Run 等のコンテナ環境で動作可（セッションはエフェメラル前提）

一方、`goal=chat`（発言生成）バッチは「1 定時 1 コールで複数 message を JSON 一括生成」する方式であり（ADR-0009）、ツールループを必要としない。既存の `@anthropic-ai/sdk` 直接呼び出しが最適であり、変更する必要がない。

## 決定

**`goal=issue`（リサーチャー）は `@anthropic-ai/claude-agent-sdk` を採用し、`goal=chat`（発言生成）は `@anthropic-ai/sdk`（単発コール）を維持する二エンジン方針を採る。**

具体的には以下のとおり決定する:

### (a) エンジン分岐

| goal | エンジン | 呼び出し方式 |
|------|---------|-------------|
| `chat` | `@anthropic-ai/sdk` | 単発 `messages.create`（JSON 一括） |
| `issue` | `@anthropic-ai/claude-agent-sdk` | `query()` によるツールループ |

### (b) 認証

`ANTHROPIC_API_KEY` を使用する（Bedrock / Vertex も利用可能だが、初期は Anthropic API を採用）。
既存の `server/src/utils/apiKey.ts`（`getApiKey()`）の鍵基盤と整合させる: DB の `CLAUDE_API_KEY` 設定値を優先し、未設定時は `ANTHROPIC_API_KEY` 環境変数にフォールバックする。

### (c) 実行形態

- **定時バッチ内のヘッドレス実行**: Express アプリとは別エントリポイントのバッチスクリプトとして実装する（ADR-0004 の定時バッチ方針に準拠）
- **ホスティング**: Cloud Run（ADR-0011）上で動作する。`--min-instances=0` で常時稼働しない
- **サブプロセスリソース**: `query()` 1 回あたり claude サブプロセスが起動し、目安として約9 1GiB RAM / ディスクを消費する
- **セッション**: エフェメラル前提。実行をまたいだ状態保持は行わない（必要な状態は DB に永続化する）

### (d) ツール / 権限スコープ

```
permissionMode: "dontAsk"
allowedTools: ["WebSearch", "WebFetch", <GitHub Issue 起票 MCP ツール>]
```

- `Bash` / `Write` / ファイル操作等の広権限ツールは本番では不許可とする
- GitHub MCP ツールは Issue 作成に必要な最小スコープのみ許可し、**生の GitHub MCP を直接 `allowedTools` に渡すのではなく、自前ラッパーツール（MCP サーバまたはカスタムツール）で呼び出す**ことで起票の決定性を担保する（後述 (e) 参照）

### (e) 起票の決定性担保

自前ラッパーを経由させることで以下を強制する:

- **重複防止**: 同一タイトル・内容の Issue が既存かどうかを起票前にチェックする
- **1 run 最大 N 件**: 1 回の `query()` 実行で起票できる Issue 数の上限を設ける（概念実証時に決定）
- **ラベル・マイルストーン整合**: `priority/medium` + 直近マイルストーンをデフォルトで付与し、`df:*` ラベルは付与しない（CLAUDE.md の状態管理方針に準拠）

### (f) コスト制御

```
maxTurns: <実測で決定>
max_budget_usd: <実測で決定>
```

- concept.md のコスト設計「1 定時 = 1 API コール」は `goal=chat` に限る表現であり、`goal=issue` は「**1 run あたり予算上限**（`max_budget_usd`）」で管理する
- 予算上限を超えた場合は SDK が自動停止するため、想定外コストを防げる
- 具体的な数値（`maxTurns` / `max_budget_usd`）は #285 の実装・実測時に確定する

## 理由

- **ツールループの手書きを排除**: `query()` を使えば Web 調査 → 分析 → Issue 起票のループを SDK が管理し、バッチコードをシンプルに保てる
- **`goal=chat` との分離**: 発言生成は単発コールが最適で変更コストが高い。目的の異なる二つのワークロードに同一の抽象を強制する必要はない
- **コスト予測性の維持**: `max_budget_usd` で 1 run あたりの上限を設けることで、バジェット超過を防ぎつつ concept.md の「コストが事前に読める」という設計思想を維持できる
- **既存認証基盤との整合**: `getApiKey()` をそのまま流用でき、管理画面からの API キー設定機能（暗号化 DB 保存）を再利用できる

## 検討した代替案

- **案A: `goal=issue` も `@anthropic-ai/sdk` でツールループを手書き**: 実装の複雑度が高く、WebSearch/WebFetch の統合も自前になる。SDK のバージョンアップ追従コストが高い。不採用
- **案B: LangChain / LangGraph などのエージェントフレームワーク**: 外部フレームワーク依存が増し、Anthropic API との整合を自前で管理する必要が生じる。Claude Agent SDK の方が Anthropic モデルとの統合が深く、認証・モデル指定の一貫性が保てる。不採用
- **案C: 全ゴールを Claude Agent SDK に統一**: `goal=chat` の単発コール方式（1 定時 1 コール・コスト予測性）を壊すことになる。サブプロセス起動オーバーヘッドもある。不採用

## 影響（結果）

- 良い影響:
  - `goal=issue` バッチがツールループを SDK に委譲でき、実装がシンプルになる
  - `maxTurns` / `max_budget_usd` によりコスト・実行時間の上限が強制される
  - `goal=chat` は既存実装のまま変更なし
- トレードオフ / 注意点:
  - `query()` 1 回あたり claude サブプロセスが起動するため、`goal=chat` に比べてリソース消費が大きい（約9 1GiB RAM）
  - Cloud Run のメモリ設定を `goal=issue` バッチ用に調整する必要がある
  - セッションがエフェメラルなため、run をまたいだ会話継続は設計上不可
  - concept.md の「1 定時 = 1 API コール」という表現は `goal=chat` にのみ当てはまる記述となり、`goal=issue` のコスト章には「run あたり予算上限」の注記が必要
- フォローアップが必要なこと:
  - #285: `goal=issue` の実装（本 ADR を前提に着手）
  - `maxTurns` / `max_budget_usd` の具体値を #285 の実測で確定し、本 ADR を更新する
  - concept.md のコスト章を `goal=issue` のコスト概念を含む形に更新する（#285 または別 Issue）
  - Cloud Run のメモリ設定見直し（#285 実装時に判断）

## 関連

- ADR-0004: server 技術スタック（本 ADR の増補対象）
- ADR-0009: Scene 廃止と message の channel 直接紐づけ（定時バッチ方針）
- ADR-0011: Cloud Run ホスティング（実行基盤）
- ADR-0016: チャンネル goal（出力契約）の導入（`goal=issue` の定義元）
- concept.md: コスト設計（「1 定時 = 1 API コール」表現への影響）
- Issue #76: UX 改善提案バッチ（`goal=issue` の原型となった企画バッチ）
- Issue #284: goal dispatch 実装（本 ADR と方向性を揃える）
- Issue #285: `goal=issue` リサーチャー実装（本 ADR を前提に実装する）
