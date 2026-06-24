# 設計書: docs/adr/README.md の「ステータス」凡例の重複「Accepted」を修正する (#791)

## 1. 目的 / 背景

`docs/adr/README.md` の「## ステータス」凡例に以下の重複が存在する:

```
- `Accepted` — 提案中（設計レビュー待ち）
- `Accepted` — 承認済み（設計 PR がマージされた）
```

1 行目の意味は「提案中（設計レビュー待ち）」であり、MADR 標準の `Proposed` ステータスを指す。
`Accepted` をコピーしてしまったミスにより凡例として矛盾しており、ADR ステータスの正本ドキュメントとして誤解を招く。

## 2. スコープ（やること / やらないこと）

- **やること**: `docs/adr/README.md` のステータス凡例 1 行目を `Proposed` に修正する
- **やること**: リポジトリテスト（`tests/adr-readme-status-legend.test.ts`）で重複がないことを機械的に保証する
- **やらないこと**: 各 ADR ファイルのステータス値の見直し（現行 ADR は全て `Accepted` or `Superseded` であり変更不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `docs/adr/README.md` のステータス凡例で `Proposed — 提案中` の行が存在する
2. ステータス凡例に `Accepted` が 2 行以上存在しない（重複ゼロ）
3. `docs/adr/README.md` の一覧表で使われているステータス語（`Accepted`, `Superseded`）が凡例に含まれる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ステータス語の整理

MADR 標準に合わせ以下を凡例として定義する:

| ステータス語 | 意味 |
|---|---|
| `Proposed` | 提案中（設計レビュー待ち） |
| `Accepted` | 承認済み（設計 PR がマージされた） |
| `Superseded by ADR-XXXX` | 別 ADR に置き換えられた |
| `Deprecated` | 廃止 |

現行 ADR ファイルで使われているステータスは `Accepted` と `Superseded by [ADR-XXXX]` のみで `Proposed` や `Deprecated` は使われていないが、凡例として将来のドラフト ADR に向けて定義しておく。

### 変更ファイル

- `docs/adr/README.md`: 凡例 1 行目 `Accepted` → `Proposed` に変更

## 5. 影響範囲 / 既存への変更

- 影響ワークスペース: `docs/`（`docs/adr/README.md` のみ）
- ADR ファイル（`docs/adr/*.md`）への変更なし
- コード変更なし

## 6. テスト計画（TDD で書くテスト一覧）

ファイル: `tests/adr-readme-status-legend.test.ts`

| テスト | 検証内容 |
|---|---|
| 凡例に Proposed 行が存在する | `Proposed` という文字列が凡例セクションに含まれる |
| 凡例に Accepted の重複がない | `Accepted` を含む凡例行が 1 行のみ |
| 凡例に Superseded の説明がある | `Superseded` が凡例に含まれる |
| 凡例に Deprecated の説明がある | `Deprecated` が凡例に含まれる |

## 7. リスク・未決事項

なし。純粋なドキュメント修正で ADR 運用への実害はない。
