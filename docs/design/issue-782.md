# 設計書: MUI v6 → v9 アップグレード (#782)

## 背景・目的

MUI v9 が 2024 年にリリースされ、React 19 との親和性向上・バンドルサイズ最適化・新しいスロット API などの改善が含まれている。本プロジェクトは React 19 SPA であるため、MUI も v9 に揃えることで依存関係の整合性を保つ。

## 受け入れ条件（Issue #782 より）

1. `client/package.json` の `@mui/material` および `@mui/icons-material` が `^9.x.x` に更新されている
2. v6 → v9 の破壊的変更に対応し、既存コンポーネントがすべて v9 API で動作する（TypeScript 型エラー・ランタイムエラーなし）
3. `client/src/theme.ts` の `createTheme` / `ThemeProvider` が v9 API に準拠し、既存の Slack 風テーマが視覚的に維持されている
4. Emotion (`@emotion/react`, `@emotion/styled`) が v9 対応バージョンに更新されている
5. `CLAUDE.md` の「アーキテクチャ」節の "MUI v6" という表記を "MUI v9" に修正している
6. `pnpm turbo run build lint test` がすべて緑

## MUI v6 → v9 の主要な破壊的変更

### v7 での変更
- `Grid` コンポーネントが刷新（Grid v2 がデフォルト）
- 一部 `sx` prop の型変更

### v8 での変更
- `PaperProps` など一部 Props が slots/slotProps に移行
- `MenuProps` 等の構造変更

### v9 での変更
- React 19 の完全サポート
- Emotion peer dependency の更新（`^11.14.0` 以上）
- `Grid` はデフォルトで v2（旧 `Grid2` コンポーネントと同等）
- `inputProps` / `InputProps` が slots/slotProps に移行（後方互換あり、一部で警告）
- `TablePagination` の `labelDisplayedRows` 等は継続
- Theme の `createTheme` API はほぼ変更なし（後方互換）
- `ThemeProvider` API 変更なし

## 影響範囲の調査結果

プロジェクトの MUI 利用状況:
- `AppRoot.tsx`: `CssBaseline`, `ThemeProvider` (styles)
- `theme.ts`: `createTheme`, `Theme` (styles)
- `components/uiParts/index.ts`: 多数の MUI Material コンポーネントを re-export
- `components/uiParts/Tooltip.tsx`: `MuiTooltip`, `TooltipProps`
- 各コンポーネント/ルートファイル: `@mui/icons-material` のアイコン

**Grid コンポーネントは使用していない**（`grep` で確認済み）ため、Grid v2 移行は不要。

## 対応方針

### パッケージ更新
```
@mui/material: ^6.1.10 → ^9.0.0
@mui/icons-material: ^6.5.0 → ^9.0.0
@emotion/react: ^11.13.5 → ^11.14.0
@emotion/styled: ^11.13.5 → ^11.14.0
```

### コンポーネント修正
1. TypeScript エラーを `pnpm --filter @hatchery/client typecheck` で洗い出す
2. エラーごとに v9 API に合わせて修正（型のみの場合が多い見込み）

### theme.ts
`createTheme` の API は v9 でも後方互換があるため、現行の Slack テーマ設定は原則そのまま維持する。コメント内の "MUI v6" 表記を更新する。

### CLAUDE.md
"MUI v6" → "MUI v9" に修正（アーキテクチャ節）。

## テスト戦略

既存テストがすべてパスすることを確認（TDD の「テストは変更しない」原則に従う）:
```bash
pnpm --filter @hatchery/client typecheck
pnpm --filter @hatchery/client test
pnpm --filter @hatchery/client lint
pnpm --filter @hatchery/client build
```
