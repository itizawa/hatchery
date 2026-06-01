# 設計書: GitHub Pages の CD を GitHub Actions で有効化する (#46)

## 1. 目的 / 背景

PR #45（Issue #9）で Storybook 8 + GitHub Pages デプロイ基盤を整備し、`.github/workflows/deploy-storybook.yml` が `develop` / `main` への push をトリガーに Storybook を GitHub Pages へ公開するワークフローとして導入された。しかし以下の理由で Storybook の CD が機能していない:

1. リポジトリの Pages 公開設定（Settings → Pages → **Source = GitHub Actions**）が未設定（現状 404）。**この設定変更は人間（リポジトリ管理者）のみが行える**（AI は GitHub の Settings を変更できない）。
2. ワークフロー本体に実用上の問題（アーティファクトパス・サブパス配信時のアセット解決）が残っていないか精査が必要。

本 Issue では「AI が機械的に対応できる部分（ワークフロー精査・修正、手順のドキュメント化、人間へのリマインド）」を完了し、「人間しかできない Pages の Source 設定」を明確に切り出して依頼する。

## 2. スコープ（やること / やらないこと）

### やること
- `.github/workflows/deploy-storybook.yml` の内容を精査し、`develop` / `main` への push で Storybook が正しくデプロイされる構成であることを確認する。
- GitHub Project Pages（`https://itizawa.github.io/ai-workspace/`）はリポジトリ名のサブパス配下で配信されるため、Storybook（Vite）のビルド `base` をそのサブパスに合わせる修正を行う（修正しないとプレビュー iframe のアセットがルート絶対パスで参照され 404 になる）。
- リポジトリ管理者が **Settings → Pages → Source を「GitHub Actions」に変更する**手順を本設計書に明記する。
- 同手順を Issue #46 にコメントしてリマインドする（人間ゲート）。

### やらないこと
- GitHub の Settings 変更そのもの（人間が行う / AI は不可）。
- `preview.tsx` の `React is not defined` 問題（**Issue #63 の別スコープ**。本 PR では触れない）。
- Storybook のコンテンツ拡充（story / MDX の追加）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

> 本 Issue は CI/CD・配信設定の infra タスクであり、ドメインロジックの単体テスト対象がない。検証は「ワークフロー構成の妥当性」「`storybook:build` がローカルで成功し base 付きアセットが出力されること」「設計書への手順記載」で行う。

- [ ] `deploy-storybook.yml` のトリガーが `develop` / `main` への push であり、`upload-pages-artifact` のパスが Storybook の出力先（`docs/storybook-static`）と一致している（精査結果を本書に記録）。
- [ ] `docs/.storybook/main.cts` の Vite `base` が、本番ビルド時にプロジェクト Pages のサブパス（`/ai-workspace/`、`STORYBOOK_BASE_PATH` で上書き可）になる。`storybook dev`（ローカル）は従来どおりルート（`/`）で動作する。
- [ ] `pnpm turbo run storybook:build` がローカルで成功し、`docs/storybook-static/index.html` 等が生成される。
- [ ] 本設計書に「リポジトリ管理者が Settings → Pages → Source を GitHub Actions に変更する」手順が記載されている（受け入れ条件 3）。
- [ ] `pnpm turbo run lint test build`（マージ前 CI ゲート）が緑。
- [ ] （人間ゲート後に成立）`develop` への push 後に `deploy-storybook.yml` が緑になり、`https://itizawa.github.io/ai-workspace/` で Storybook が正しく表示される。

## 4. 設計方針

### 4.1 ワークフロー精査結果（`deploy-storybook.yml`）

精査の結論: **トリガー・権限・アーティファクトパス・デプロイアクションは GitHub Pages の標準パターンに準拠しており、ワークフロー本体の修正は不要**。

| 観点 | 現状 | 判定 |
|------|------|------|
| トリガー | `push` to `develop` / `main` | ✅ |
| 権限 | `contents: read` / `pages: write` / `id-token: write` | ✅ `actions/deploy-pages@v4` の要件を満たす |
| build → deploy のジョブ分割 | `deploy` が `needs: build` | ✅ |
| アーティファクトパス | `docs/storybook-static` | ✅ `docs/` ワークスペースで `storybook build` した既定出力と一致 |
| concurrency | build はキャンセル可・deploy はキャンセル不可 | ✅ デプロイ中断によるサイト破損を回避 |

→ ワークフロー YAML は変更しない（精査のみ）。

### 4.2 サブパス配信への対応（Vite `base`）

GitHub Project Pages は `https://<owner>.github.io/<repo>/` のサブパスで配信される。Storybook（Vite ビルダー）の既定 `base` は `/` のため、プレビュー iframe が読み込むモジュール/アセットが `/(assets|sb-*)/…` のルート絶対パスになり、サブパス配下では 404 になる。

対応: `docs/.storybook/main.cts` の `viteFinal` で、**本番ビルド時のみ** `config.base` をサブパス（`/ai-workspace/`）に設定する。環境変数 `STORYBOOK_BASE_PATH` があればそれを優先し、リポジトリ名変更やフォークにも追従できるようにする。`storybook dev`（`configType !== "PRODUCTION"`）ではルート `/` のままとし、ローカル開発体験を変えない。

```ts
viteFinal: async (config, { configType }) => {
  // ...既存の alias 設定...
  if (configType === "PRODUCTION") {
    config.base = process.env.STORYBOOK_BASE_PATH ?? "/ai-workspace/";
  }
  return config;
};
```

> 注: 本修正の最終確認（サブパスでアセットが解決されること）は、人間が Pages の Source を設定して初回デプロイが走った後に `https://itizawa.github.io/ai-workspace/` を開いて確認する必要がある（AI 単独では検証不能）。

### 4.3 人間が行う Pages 公開設定（受け入れ条件 3）

リポジトリ管理者が以下を一度だけ実施する（AI は実行不可）:

1. GitHub リポジトリ `itizawa/ai-workspace` の **Settings** を開く。
2. 左メニューの **Pages** を選択。
3. **Build and deployment** の **Source** を **「GitHub Actions」** に変更する（「Deploy from a branch」ではない）。
4. 設定後、`develop`（または `main`）へ次に push されたタイミングで `Deploy Storybook to GitHub Pages` ワークフローが走り、`https://itizawa.github.io/ai-workspace/` に公開される。
5. 必要なら Actions タブから当該ワークフローを手動再実行して初回デプロイを起こす。

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更 |
|---|---|
| `docs/` | `.storybook/main.cts` に本番ビルド時の Vite `base` 設定を追加 |
| `docs/design/` | 本設計書 `issue-46.md` を追加 |
| ルート | `.github/workflows/deploy-storybook.yml` は**精査のみ・変更なし** |

> マージ前 CI ゲート（`ci.yml`）は `turbo run lint test build` を実行し `storybook:build` を含まないため、`main.cts` の `base` 追加は CI ゲートの結果に影響しない（ローカルで `storybook:build` 成功を別途確認する）。

## 6. テスト計画

- 既存の `client/src/components/*.stories.test.ts`（stories のメタ検証）が引き続き緑であること。
- `pnpm turbo run lint test build` が緑であること（マージ前ゲート）。
- `pnpm turbo run storybook:build` が成功し `docs/storybook-static/index.html` が生成されること（手動確認）。
- 本 Issue にドメインロジックの新規追加はないため、新規の単体テストは追加しない（infra/config/docs タスク）。

## 7. リスク・未決事項

- **サブパス配信の最終検証は人間の Pages 設定後にしかできない。** `base` 修正は標準的な対応だが、初回デプロイ後に実表示を確認する必要がある。Storybook 8 のマネージャ UI は相対パスで配信されるため、本修正は主にプレビュー iframe のアセット解決を担保する。
- `base` をリポジトリ名（`/ai-workspace/`）にハードコードするとリポジトリ名変更/フォークで崩れるため、`STORYBOOK_BASE_PATH` で上書き可能にしてリスクを緩和した。
- `preview.tsx` の `React is not defined`（Issue #63）が未解決の場合、Pages 上でストーリー本体が表示されない可能性がある。これは #63 の責務であり本 PR では扱わない（スコープ分離）。
