# 設計書: .dockerignore が client/docs を全除外し server の Docker build が package.json not found で失敗する (#144)

## 1. 目的 / 背景

root の `.dockerignore` が `client` と `docs` ディレクトリを丸ごと除外しているため、
`server/Dockerfile` が pnpm workspace 解決に必要な `COPY client/package.json` / `COPY docs/package.json`
を実行すると "not found" エラーになり、`Deploy Server (dev)` の Docker build が失敗する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `.dockerignore` に `!client/package.json` / `!docs/package.json` を追加し、各ディレクトリの `package.json` のみをビルドコンテキストに含める
- 回帰防止テスト（`tests/dockerignore.test.ts`）を追加し、Dockerfile が参照する全 package.json が除外されないことを CI で検証する

**やらないこと:**
- `server/Dockerfile` の変更（既に正しい）
- client / docs の他ファイルを Docker イメージに含める

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `.dockerignore` が `client/package.json` と `docs/package.json` を**再 include** する
- `client/` `docs/` 配下のその他ファイル（ソース等）は引き続き除外される
- `server/Dockerfile` の `COPY */package.json` で参照される各パスが `.dockerignore` 適用後もビルドコンテキストに残る（除外されない）ことをテストで保証する
- `pnpm test` / `pnpm lint` が緑

## 4. 設計方針

### .dockerignore の修正

`.dockerignore` の否定パターン（`!`）を利用する。Docker は `.gitignore` と同様に否定パターンをサポートしており、除外ルールの直後に `!` で始まる例外を記述することで特定ファイルだけをビルドコンテキストに残せる。

```diff
 # 開発・ドキュメント
 .claude
 client
+!client/package.json
 docs
+!docs/package.json
```

この記述により:
- `client` → `client/` ディレクトリ全体を除外
- `!client/package.json` → `client/package.json` だけを例外的にビルドコンテキストへ戻す

同じパターンが Issue 本文の「補足（検証済みの修正案）」でも確認済み。

### 回帰防止テスト（tests/dockerignore.test.ts）

`.dockerignore` の除外ルールを純粋関数で評価し、以下を検証する:

1. `client/package.json`・`docs/package.json` が除外されないこと
2. `client/src/main.ts`・`docs/adr/*.md` のような他ファイルが引き続き除外されること
3. `server/Dockerfile` の全 `COPY */package.json` 行を正規表現で抽出し、各パスが除外されないこと（将来 Dockerfile に COPY 行が追加されても自動で検証される）

#### `.dockerignore` 評価ロジック

規則の評価は行の順序通り「最後にマッチしたルール」が優先される仕様（Docker docs 準拠）:
- 非否定ルール → 対象を除外（`excluded = true`）
- 否定ルール（`!` 始まり）→ 対象を含める（`excluded = false`）
- マッチ判定: 完全一致 or ディレクトリプレフィックス（`pattern/`）の前方一致

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|---------|
| `.dockerignore` | `!client/package.json` / `!docs/package.json` を追加（2 行） |
| `tests/dockerignore.test.ts` | 新規追加 |

server/Dockerfile・各 package.json・ワークスペース設定は変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | 期待 |
|--------|------|
| `client/package.json` は除外されない | `isExcluded(...) === false` |
| `docs/package.json` は除外されない | `isExcluded(...) === false` |
| `client/src/main.ts` は除外される | `isExcluded(...) === true` |
| `docs/adr/0001.md` は除外される | `isExcluded(...) === true` |
| Dockerfile の全 `COPY */package.json` パスが除外されない | 各パスで `isExcluded(...) === false` |

## 7. リスク・未決事項

- `.dockerignore` のパターン評価は本テストの独自実装（簡易版）であり、複雑な glob パターン（`*`・`?`・`**`）には対応しない。現行 `.dockerignore` に含まれる `*/node_modules`・`*/dist` 等は `client/package.json` に当たらないため影響なし。
- Docker の実際の挙動とテストの評価ロジックにズレが生じる可能性はゼロではないが、今回の修正は `!` による単純な例外追加であり、動作確認済みパターンのため問題なし。
