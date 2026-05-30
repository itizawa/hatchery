# 設計書: client: Slack 風UI のライトモード化 (#31)

## 1. 目的 / 背景

Hatchery のクライアント UI は Slack 風デザインを採用しているが、`client/src/theme.ts` の MUI テーマが
`mode: "dark"`（暗色背景 + Slack オーバジン色サイドバー）で構成されている。Issue #31 では、これを
**ライトモードに統一**し、テキスト・背景・ボーダーの視認性を保ったまま Slack 風の見た目を維持する。

テーマは `AppRoot`（本番）と Storybook の `docs/.storybook/preview.tsx`（視認確認）の両方から
`slackTheme` として参照される単一情報源なので、テーマ定義をライト化すれば本番・Storybook の双方が
同時にライトモードになる。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/theme.ts` の `slackTheme` を `mode: "light"` のライトパレットへ変更する。
- `SLACK_COLORS` をライトモード用の配色（明るい背景・サイドバー・視認可能なテキスト）に更新する。
- ライト化に伴いサイドバー文字色が不可視になる `client/src/routes/RootLayout.tsx` を、
  テーマのテキスト色（`text.primary`）で視認できるよう修正する。

### やらないこと
- ダークモード／テーマ切替（トグル）機能の追加（MVP 外）。
- 新規コンポーネント・画面の追加、レイアウト構造の変更。
- Storybook 構成自体の変更（preview は既に `slackTheme` を参照済みのため変更不要）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `slackTheme.palette.mode` が `"light"` である。
2. `slackTheme.palette.primary.main` が Slack 風ブルー（`SLACK_COLORS.blue`）のままである。
3. `slackTheme.palette.background.default`（メイン背景）が `SLACK_COLORS.background` であり、
   旧ダーク背景（`#1A1D21`）ではない明るい色である。
4. `slackTheme.palette.background.paper`（サイドバー背景）が `SLACK_COLORS.sidebar` であり、
   旧オーバジン色（`#3F0E40`）ではない明るい色である。
5. メイン背景とサイドバー背景は互いに異なり、レイアウトの境界が判別できる。
6. `slackTheme.palette.text.primary` が暗色（ライト背景上で視認できるテキスト色）である。
7. `RootLayout` のサイドバー文字色が不可視の白（`common.white`）に固定されておらず、
   テーマのテキスト色で描画される（既存の描画テストが緑のまま）。

## 4. 設計方針

- MUI v6 + Emotion の `createTheme()` で `palette.mode: "light"` を指定する。MUI のライトモード
  デフォルトにより `text.primary` は暗色（`rgba(0,0,0,0.87)`）となり、ライト背景上で視認できる。
- `SLACK_COLORS` の役割は維持しつつ値をライト用に差し替える:
  - `blue`（primary）: `#1164A3`（Slack ブルー。ライト背景でもアクセシブルなので据え置き）
  - `background`（`background.default`、メイン）: `#FFFFFF`
  - `sidebar`（`background.paper`、サイドバー）: `#F8F8FA`（白に近い明るいグレー）
- `RootLayout` のサイドバー `Box` は `color: "common.white"` をやめ、`color: "text.primary"` を用いる
  ことで、ライトサイドバー上でも文言（ワークスペース名・チャンネル名・設定リンク）が視認できる。
  リンクは `color="inherit"` のままで、継承元が `text.primary` になるため整合する。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client**（common / server / docs への変更なし）。

- `client/src/theme.ts` — パレットをライト化（`SLACK_COLORS` の値と `mode`）。
- `client/src/theme.test.ts` — 受け入れ条件 #1〜#6 を表すテストへ更新（TDD で先行）。
- `client/src/routes/RootLayout.tsx` — サイドバー文字色を `text.primary` に変更。
- `docs/.storybook/preview.tsx` — 変更不要（`slackTheme` 参照のため自動的にライト化）。

依存方向（client → common）に変更はなく、ADR-0003（MUI v6 + Emotion / Slack 風テーマ）に整合する。

## 6. テスト計画（TDD で書くテスト）

`client/src/theme.test.ts`（既存を受け入れ条件に合わせて更新）:
- `palette.mode === "light"`
- `palette.primary.main === SLACK_COLORS.blue`
- `palette.background.default === SLACK_COLORS.background` かつ `!== "#1A1D21"`
- `palette.background.paper === SLACK_COLORS.sidebar` かつ `!== "#3F0E40"`
- `background.default !== background.paper`（境界判別）
- `palette.text.primary` が暗色（`rgba(0, 0, 0` を含む = ライトモード既定の暗色テキスト）

回帰確認: `client` の既存テスト（`AppRoot.test.tsx` などテーマを利用する描画テスト）が緑のままであること。

## 7. リスク・未決事項

- 「Slack 風」の解釈としてサイドバーをオーバジン色のまま残す案もあるが、本 Issue は
  「ライトモードに統一」「視認性を保つ」を明示しているため、白系の明るいサイドバーを採用する。
- ローカルは Node 22 だが CI は `.nvmrc`（Node 26）。テーマ変更はランタイム非依存で、
  ローカル（Vitest）と CI の双方で同一結果になる。
