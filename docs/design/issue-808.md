# 設計書: MUI アイコンを Rounded バリアントに統一し ESLint で強制する

Issue: #808

## 背景・目的

現状、`@mui/icons-material` からバリアント無し（Filled）を直接 default import している箇所が client 配下 10 ファイル以上に存在する。デザイン方針として「アイコンは角丸（Rounded）バリアントに統一する」ことをルールとして徹底し、ESLint で機械的に強制する。

## 受け入れ条件

1. 既存の全 `@mui/icons-material/*` import を Rounded バリアントへ置換する（ブランドアイコン X は対象外）
2. ESLint で非 Rounded アイコンの import を機械的に禁止する（`no-restricted-imports` の `patterns` に regex 追加）
3. ルール違反が実際に lint エラーになることを確認する
4. `CLAUDE.md` にルールを明文化する
5. 規約遵守と CI 緑

## 置換対象アイコン一覧

| ファイル | 旧 import | 新 import |
|---------|-----------|-----------|
| `client/src/components/AppHeader.tsx` | `Menu` | `MenuRounded` |
| `client/src/components/ScrollToTopButton.tsx` | `KeyboardArrowUp` | `KeyboardArrowUpRounded` |
| `client/src/components/ShareButton.tsx` | `Share` | `ShareRounded` |
| `client/src/components/ShareButton.tsx` | `ContentCopy` | `ContentCopyRounded` |
| `client/src/components/ShareButton.tsx` | `X` | `X`（例外: Rounded バリアント無し） |
| `client/src/components/SidebarCommunitySection.tsx` | `ExpandLess` | `ExpandLessRounded` |
| `client/src/components/SidebarCommunitySection.tsx` | `ExpandMore` | `ExpandMoreRounded` |
| `client/src/components/SidebarCommunitySection.tsx` | `Explore` | `ExploreRounded` |
| `client/src/components/VoteControl.tsx` | `ArrowDownward` | `ArrowDownwardRounded` |
| `client/src/components/VoteControl.tsx` | `ArrowUpward` | `ArrowUpwardRounded` |
| `client/src/routes/PostThreadScene.tsx` | `ChevronLeft` | `ChevronLeftRounded` |
| `client/src/routes/RootLayout.tsx` | `AdminPanelSettings` | `AdminPanelSettingsRounded` |
| `client/src/routes/RootLayout.tsx` | `Description` | `DescriptionRounded` |
| `client/src/routes/RootLayout.tsx` | `EmojiEvents` | `EmojiEventsRounded` |
| `client/src/routes/RootLayout.tsx` | `Home` | `HomeRounded` |
| `client/src/routes/RootLayout.tsx` | `PrivacyTip` | `PrivacyTipRounded` |
| `client/src/routes/RootLayout.tsx` | `TrendingUp` | `TrendingUpRounded` |
| `client/src/routes/WorkerRankingScene.tsx` | `EmojiEvents` | `EmojiEventsRounded` |

## 例外一覧（Rounded バリアントが存在しないアイコン）

- `@mui/icons-material/X`（旧 Twitter ブランドアイコン）: Rounded バリアントが存在しないため対象外

## ESLint ルール設計

`eslint.config.mjs` の client 向け `no-restricted-imports` ブロックに以下を追加:

```js
{
  group: ["@mui/icons-material"],
  message: "barrel import 禁止。Rounded バリアントを個別 import する（例: @mui/icons-material/HomeRounded）。",
},
{
  regex: "^@mui/icons-material/(?!.*Rounded$)(?!X$)",
  message: "アイコンは Rounded バリアントを使う（例: @mui/icons-material/HomeRounded）。",
},
```

`regex` の説明:
- `^@mui/icons-material/` : icons-material のサブパス import にマッチ
- `(?!.*Rounded$)` : `Rounded` で終わるもの（= Rounded バリアント）を除外
- `(?!X$)` : `X`（ブランドアイコン例外）を除外

## TDD アプローチ

このリポジトリには `tests/` に規約テスト（リポジトリ規約テスト）がある。ESLint ルールの動作確認は `pnpm lint` を実行して確認する。また `tests/` に ESLint ルールの違反検知テストを追加することで受け入れ条件 3 を担保する。

ただし、今回の変更は主に:
1. ESLint 設定変更（機械的に検証可能）
2. 既存ファイルの import 置換（lint が通ることで検証）

であるため、TDD の「テストを先に書く」は ESLint ルール追加 → 違反確認 → 置換で lint 通過 の順で実施する。

## 実装順序

1. `docs/design/issue-808.md` 作成（本ファイル）→ コミット
2. ESLint ルールを `eslint.config.mjs` に追加（まず lint が失敗することを確認）→ コミット
3. 全対象ファイルのアイコン import を Rounded へ置換（lint が通ることを確認）→ コミット
4. `CLAUDE.md` にアイコン規約を明文化 → コミット
5. `pnpm turbo run build test lint` で CI 確認
