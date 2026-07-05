# ADR-0037: Storybook の撤去（ADR-0007 を Supersede）

- ステータス: Accepted
- 日付: 2026-07-05
- 関連 Issue: #1076

## コンテキスト（背景）

ADR-0007 で `docs` ワークスペースに Storybook 8 を構築し、設計 MDX と client のコンポーネントカタログを GitHub Pages にデプロイする方針を決定した。しかし運用中にメンテナンスが追いつかず、以下の技術的負債が積み上がっていた。

- `docs/package.json` の Storybook 関連依存（`storybook` / `@storybook/*` / `msw-storybook-addon`）が `^8.0.0` 系のまま更新されず放置されていた。
- `#166`（本番 base path 404）・`#63`（`React is not defined`）・`#107`（`QueryClient` 未設定エラー）・`#198`（MSW モック不一致でログイン画面リダイレクト）など、Storybook 起因の不具合 Issue が繰り返し発生していた。
- 設計書・ADR の閲覧手段としての実利用実績が薄く、運用コストに見合う価値を生めていなかった。

## 決定

**Storybook をレンダリング/デプロイ手段として撤去する。** ADR-0007 の決定を Supersede する。

- `docs/package.json` から Storybook 関連 script・devDependencies を削除する。
- `client/src` の `*.stories.tsx` を削除する。
- `docs/src` の MDX・Storybook 前提テスト（`storybook-preview.test.ts` 等）を削除する。あわせて、MDX 削除により唯一の消費者を失う `MarkdownDoc` コンポーネント・`fieldSpec` 抽出ロジック・`gen-field-specs` 生成スクリプトも削除する。
- `.github/workflows/deploy-storybook.yml`（GitHub Pages デプロイ）を削除する。
- `turbo.json` の `storybook:build` 系タスクを削除する。
- 設計書（`docs/design/issue-<N>.md`）・ADR（`docs/adr/*.md`）という **Markdown 正本の管理自体は変更しない**。Dark Factory ワークフローの正本管理は Markdown ファイルであり続ける。

## 理由

- **運用コスト超過**: Storybook のバージョン追従・設定の保守にかけるコストに対し、実際の閲覧価値が見合わなかった。
- **繰り返す不具合**: base path・React ランタイム・QueryClient・MSW モックなど、Storybook 特有の設定不備に起因する不具合が複数回発生し、都度対応コストがかかっていた。
- **正本は Markdown のまま維持できる**: ADR・設計書は元々 `.md` を正本としており（ADR-0007 自身の決定）、Storybook はその表示レイヤーに過ぎない。表示レイヤーを撤去しても正本の管理体制（Git 上のレビュー・差分）は失われない。

## 検討した代替案

- **Storybook をバージョンアップして維持する**: 不具合の根治にはなるが、継続的なメンテナンスコストが発生し続ける点は変わらない。観察エンタメプロダクトの MVP フェーズでは投資対効果が低いと判断。
- **他のドキュメントサイトツール（Docusaurus / VitePress 等）へ移行する**: 閲覧手段の再構築自体が新たな実装コストを生む。必要になった時点で別 Issue として検討する方が妥当。

## 影響（結果）

- 良い影響: `docs` ワークスペースの依存関係が大幅に減り、Storybook 起因の不具合対応が不要になる。CI の `deploy-storybook.yml` ワークフローも無くなり実行コストが減る。
- トレードオフ: 設計書・ADR・コンポーネントカタログを 1 つの Pages サイトで横断的に閲覧する手段が一時的に無くなる。ADR・設計書は GitHub 上で直接閲覧可能なため実務上の支障は小さいと判断。
- フォローアップ: 設計書・ADR の閲覧手段を Storybook 以外で再構築するかどうかは本 ADR のスコープ外。必要になった場合は別 Issue で検討する。
