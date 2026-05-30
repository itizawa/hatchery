# ADR-0007: ドキュメント基盤（Storybook MDX + GitHub Pages）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #1

## コンテキスト（背景）

Issue #1 で「設計書は `docs` に記載し、Storybook を MDX で表示、デプロイ先は GitHub Pages」と示されている。設計書（ADR・各 Issue の設計）と UI コンポーネントのカタログを同じ場所で閲覧でき、PR とともに更新される状態にしたい。Dark Factory ワークフローでは設計書がレビュー対象の一次成果物なので、閲覧性が重要。

## 決定

**`docs` ワークスペースに Storybook を構築し、設計 MDX と client のコンポーネント stories を集約して、GitHub Pages に静的デプロイする。**

- **ツール: Storybook 8**（Vite ビルダー、`@storybook/addon-docs` による MDX サポート）。
- **集約対象**:
  - 設計ドキュメント（MDX）: ADR・各 Issue の設計書を MDX として Storybook の Docs ページに表示する。
  - コンポーネントカタログ: `client` の `*.stories.tsx` を Storybook に取り込み、UI を実物で確認する。
- **Markdown の扱い**: ADR は `docs/adr/*.md`（Git 上の正本・レビュー対象）として管理し、Storybook では MDX ラッパーから取り込んで表示する。Markdown を正本にし、表示は MDX が参照する形にすることで、PR の差分が読みやすい正本を保つ。
- **デプロイ: GitHub Pages**。GitHub Actions で `storybook-static` をビルドし、Pages にデプロイする（`actions/deploy-pages`）。トリガーは `develop`（または `main`）への push。
- ビルド成果物（`storybook-static`）はコミットしない（ADR-0002 の `.gitignore`）。

## 理由

- **Storybook + MDX**: コンポーネントの実物カタログと文章ドキュメント（設計・ADR）を 1 つのサイトに統合でき、設計と UI を相互参照しながら閲覧できる。Vite ビルダーで client（ADR-0003）とビルド設定を共有できる。
- **ADR は .md を正本に**: レビュー（設計ゲート）では生の Markdown 差分が最も読みやすい。表示用 MDX は薄いラッパーに留め、二重管理を避ける。
- **GitHub Pages**: 追加インフラなしで静的サイトを無料配信でき、リポジトリ・Actions と一体運用できる。Issue 方針どおり。

## 検討した代替案

- **Docusaurus / VitePress（専用ドキュメントサイト）**: 文章ドキュメントには優れるが、UI コンポーネントカタログを統合できない。設計と UI を 1 つにまとめる狙いから Storybook を採用。
- **設計書を MDX のみで管理（.md 正本を持たない）**: Storybook ネイティブだが、PR レビュー時の差分可読性が落ち、Git 上での検索・参照もしにくい。.md 正本 + MDX 表示を採用。
- **Storybook を client に同居**: 可能だが、ドキュメントのビルド/デプロイ境界が曖昧になる。ADR-0001 の方針どおり `docs` を独立ワークスペースにする。

## 影響（結果）

- 良い影響: 設計書・ADR・UI カタログが 1 つの Pages サイトで閲覧でき、PR と同期して更新される。Dark Factory の設計ゲートで参照しやすい。
- トレードオフ: `docs` の Storybook が `client` のコンポーネントを参照するため、両者のビルド依存が生じる（Turborepo で順序管理）。MDX ラッパーの薄い追加コスト。
- フォローアップ: Storybook 初期化・MDX 取り込みの仕組み・Pages デプロイ用 GitHub Actions ワークフローは別 Issue（セットアップ）で実装する。Pages の公開設定（リポジトリ Settings）も必要。
