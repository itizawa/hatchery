# 設計書: ADR ホスティング先（Cloudflare Pages）と SPA でのページ毎 OGP 方針の決定 (#19)

## 1. 目的 / 背景

Hatchery のデプロイ先がこれまで ADR に明記されていなかった（ADR-0003 は client の技術スタックを
定義するのみで、ホスティング先は「別途決定」と保留されていた）。デプロイ先を **Cloudflare** とする
方針が固まりつつあるため、これを新しい技術決定として ADR に記録する。

あわせて、ADR-0003 の「Vite + React SPA / SSR なし」構成では、クローラ（Slackbot・X・
facebookexternalhit 等）が JS を実行しないため、**ページ毎の OGP がシェア時に届かない**という既知の
制約がある。この制約への対応方針も同じ ADR に整理し、「OGP のために SSR 化（= ADR-0003 の覆し）が
必要なのか」という将来の論点を未然に潰す。

## 2. スコープ（やること / やらないこと）

### やること
- `docs/adr/0008-*.md` を `template.md`（MADR 風）形式で新規作成し、以下を決定として記録する。
  - ホスティング先 = **Cloudflare Pages**（Vite ビルド成果物の SPA を静的ホスト）。
  - SPA でのページ毎 OGP の制約と、その対応方針（Cloudflare Pages Functions + `HTMLRewriter` で
    後付け可能・**SSR 化は不要**）。
  - ADR-0003（SSR なし SPA）を維持できることの明記。
- `docs/adr/README.md` の一覧表に 0008 の行を追加する。

### やらないこと（スコープ外・後続）
- Pages Functions / `HTMLRewriter` の**実装**（MVP のコア体験にページ毎シェアは含まれないため、
  必要になってから別 Issue）。
- Cloudflare へのデプロイパイプライン（CI/CD）の構築。
- 動的 OGP 画像生成（`og:image` の動的生成）。
- アプリコードの変更（本 Issue のアウトプットは ADR 1 本 + README 更新のみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `docs/adr/0008-<kebab>.md` が存在し、MADR セクション（`## コンテキスト（背景）` / `## 決定` /
   `## 理由` / `## 検討した代替案` / `## 影響（結果）`）と先頭メタ（ステータス / 日付 / 関連 Issue #19）を持つ。
2. 「ホスティング先 = Cloudflare Pages」が決定として記録されている。
3. SPA でのページ毎 OGP の制約と、対応方針（Pages Functions + `HTMLRewriter` で後付け可・SSR 化不要）が記述されている。
4. ADR-0003（client スタック）との関係（**SSR なし SPA を維持**）が明記されている。
5. `docs/adr/README.md` の一覧表に 0008 の行（ファイルへのリンク付き）が追加されている。
6. 検討した代替案として「Vercel/Netlify の自動プリレンダリング」と「SSR/SSG への移行」が比較され、
   不採用理由が示されている。

## 4. 設計方針

- `docs/adr/template.md` をベースに MADR 風で記述。ステータスは `Accepted`、日付は 2026-05-30、関連 Issue は #19。
- ファイル名は連番規則 `NNNN-kebab-case-title.md` に従い `0008-cloudflare-pages-hosting-and-ogp.md`。
- 「決定」で (1) ホスティング = Cloudflare Pages、(2) OGP は当面 `index.html` 共通で十分・必要時は
  Pages Functions + `HTMLRewriter` でエッジ後付け・SSR 化不要、を明確に分けて記す。
- 「影響」に「MVP 段階では OGP は共通で十分」「将来 OGP が必要なら別 Issue で Pages Functions 実装」を残す。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **docs のみ**（`docs/adr/`）。client / server / common のコードは変更なし。
- ADR-0003 は覆さない（関係を新 ADR 側に明記。ADR-0003 自体は編集しない）。

## 6. テスト計画（TDD で書くテスト一覧）

リポジトリの precedent（`tests/ci-workflow.test.ts` 等の構造テスト、実行は `pnpm test:repo` =
`vitest run --dir tests`）に倣い、`tests/adr-cloudflare-hosting.test.ts` を追加する:

- ADR ファイル（`docs/adr/0008-*.md`）が 1 つだけ存在する。
- 必須メタ（`ステータス` / `日付` / `関連 Issue: #19`）を含む。
- 必須 MADR セクション見出しをすべて含む。
- 本文に「Cloudflare Pages」「HTMLRewriter」「Pages Functions」「OGP」を含む。
- ADR-0003 への言及（`ADR-0003` 文字列）と「SSR」言及を含む（SSR 化不要・SPA 維持の文脈）。
- 代替案として「Vercel」「Netlify」「SSR」「SSG」の比較語を含む。
- `docs/adr/README.md` に `0008` の行（`./0008-...md` へのリンク）が存在する。

## 7. リスク・未決事項

- 本 Issue はドキュメントのみのためランタイムリスクは無い。
- 構造テストは `tests/` 配下で `test:repo` 実行（CI の `turbo run test` 対象外＝ワークスペースの
  test のみが CI ゲート）。本変更は doc + README + tests/ の追加のみで、ワークスペースの lint/test/build に
  影響しないため CI（`turbo run lint test build`）は緑のまま。
- 実 OGP 配信が必要になった時点で Pages Functions + `HTMLRewriter` の実装 Issue を起票する（本 ADR の「影響」に明記）。
