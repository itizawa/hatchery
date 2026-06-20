# Issue #752 設計書: 腐敗防止層の Tooltip に arrow を常時有効にする

## 背景

`client/src/components/uiParts/index.ts` で MUI `Tooltip` を re-export しているが、現状は単純な再エクスポートのみ（`arrow` デフォルト `false`）。腐敗防止層でラッパーコンポーネント化し `arrow={true}` を固定することで、全 Tooltip にアロー矢印を一元適用できる。

## 設計判断

### ラッパーコンポーネントの配置

`client/src/components/uiParts/Tooltip.tsx` を新規作成する。これにより:

1. 腐敗防止層としての責務が明確になる（外部ライブラリの直接依存を断ち切る）
2. `index.ts` は named export に統一され、他のラッパーコンポーネント（今後追加される場合）との一貫性が保たれる
3. デフォルト値の変更は1ファイルで完結し、既存の使用箇所には変更不要

### arrow のデフォルト値

`arrow = true` をデフォルトとする。これにより:

- 全 Tooltip に一貫してアロー矢印が表示される
- 既存 5 箇所のコード変更は不要
- `arrow={false}` を明示することでオーバーライド可能（設計の柔軟性を維持）

### 受け入れ条件

1. `client/src/components/uiParts/Tooltip.tsx` を新規作成し、`arrow` を `true` にデフォルト設定するラッパーコンポーネントを実装する
2. `client/src/components/uiParts/index.ts` の `Tooltip` の行を named export に切り替える
3. 既存の使用箇所（5箇所）はコード変更不要で、自動的に `arrow` が付いて表示される
4. `arrow={false}` を明示的に渡した場合はアロー非表示にオーバーライドできる
5. 変更は `client/` のみで完結。`pnpm turbo run build test lint` が緑

## テスト方針（TDD）

`client/src/components/uiParts/Tooltip.test.tsx` にユニットテストを追加する:

- `arrow` プロパティが未指定の場合、`true` がデフォルトで適用されること
- `arrow={false}` を渡した場合、`false` でオーバーライドされること
- その他の `TooltipProps` が正しく MUI Tooltip に渡されること

## 影響範囲

- `client/src/components/uiParts/Tooltip.tsx` — 新規作成
- `client/src/components/uiParts/index.ts` — Tooltip の export 行を変更
- 既存の Tooltip 使用箇所 — 変更不要（APIは後方互換）
