# Issue #750: サイドバーのコミュニティ一覧にアイコン（Avatar）を表示する

## 背景と目的

`SidebarCommunitySection.tsx` の `SidebarCommunityItems` コンポーネントは現在コミュニティ名のみを
`ListItemText` で表示しており、アイコンが表示されない。
`Community` 型には `iconUrl`（nullable）フィールドが既に存在し、`GET /api/communities` で返却済み。
`CommunitySidebarCard.tsx` に Avatar + イニシャルフォールバックの実装パターンが確立されている。

この Issue では、サイドバーのコミュニティ一覧に Avatar を追加し、視覚的識別性を向上させる。

## 設計判断

### 実装箇所
- `client/src/components/SidebarCommunitySection.tsx` の `SidebarCommunityItems` のみ
- `server`・`common`・OpenAPI 変更不要

### Avatar 配置
- `ListItemButton` 内に `ListItemIcon` を追加し、その中に `Avatar`（24×24px）を配置
- `ListItemIcon` は既に `uiParts/index.ts` に export 済み
- `Avatar` も `uiParts/index.ts` に export 済み

### Avatar 表示ロジック
- `community.iconUrl` が設定されている場合: `src={community.iconUrl ?? undefined}` で画像表示
- `null`/`undefined` の場合: `community.name[0]` をイニシャルとしてフォールバック表示
- `CommunitySidebarCard.tsx` と同じパターン

### サイズ・スタイル
- Avatar サイズ: 24×24px（サイドバーの compact な表示に合わせる）
- `ListItemIcon` の `minWidth` はサイドバー幅・レイアウトを崩さないよう調整（36px 程度）

## 受け入れ条件確認

1. 各リスト項目の左側に MUI Avatar（24×24px）を表示する
2. `iconUrl` 設定時は画像、null/undefined 時はイニシャルフォールバック
3. `Avatar` を `ListItemIcon` に配置し、右に `ListItemText`（コミュニティ名）
4. サイドバー横幅（260px）・文字サイズ（body2）を崩さない
5. `client/` のみで完結
6. `pnpm turbo run build test lint` が緑
