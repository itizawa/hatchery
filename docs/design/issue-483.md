# 設計書: サイドバーのコミュニティ一覧を collapse で開閉できるようにする (#483)

## 1. 目的 / 背景

サイドバーの `SidebarCommunitySection`（`client/src/components/SidebarCommunitySection.tsx`）は、見出し「コミュニティ」とコミュニティ一覧・「探す」リンクを常に展開した状態で表示している。コミュニティが増えるとサイドバーが縦に長くなり、グローバルナビ（ホーム / 人気）や管理画面リンクが押し下げられて見通しが悪い。

Reddit 風 UI（ADR-0018 / ADR-0019）では、サイドバーの各セクションを見出しクリックで collapse（折りたたみ）できるのが一般的。見出し「コミュニティ」の右端に chevron（∧ / ∨）を付け、クリックで一覧部を開閉できるようにする。

## 2. スコープ（やること / やらないこと）

### やること

- `SidebarCommunitySection` の見出し「コミュニティ」をクリック可能なトグルボタンにする。
- 見出し右端に開閉状態を示す chevron アイコン（展開時 `ExpandLess` ∧ / 折りたたみ時 `ExpandMore` ∨）を表示し、状態に応じて切り替える。
- 本体部（コミュニティ一覧・「探す」リンク）を MUI `Collapse` で包み、トグルで開閉する。
- 開閉状態は `useState` で管理し、初期状態は「展開」とする。
- トグルボタンに `aria-expanded` を付与し、開閉状態と整合させる。
- `uiParts` バレルに未エクスポートの `Collapse` を追加し、そこから import する。
- テスト（`SidebarCommunitySection.test.tsx`）に「初期は展開」「クリックで折りたたみ→再クリックで展開」「aria-expanded の切り替わり」を追加。
- e2e ユースケースに「サイドバーのコミュニティセクションを開閉できる」を追加（community エリア）。

### やらないこと

- 開閉状態の localStorage 等への永続化（本 Issue スコープ外）。
- 「コミュニティを管理する」ギア項目・各コミュニティ右の★（お気に入り/購読）アイコン。
- グローバルナビ（ホーム / 人気）や他セクションの collapse 化。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 見出し「コミュニティ」がクリック可能なトグルになっており、クリックするとコミュニティ一覧・「探す」リンクを含む本体部が開閉する。
2. 見出し右端に開閉状態を示す chevron（展開時 ∧ / 折りたたみ時 ∨）を表示し、開閉状態に応じて切り替わる。
3. トグルボタンに `aria-expanded` を付与し、開閉状態と本体の表示/非表示が整合する。
4. 開閉状態は `useState` で管理し、初期状態は「展開」。
5. 折りたたみ時はコミュニティ一覧・「探す」リンクが DOM 上で非表示（または非マウント）になることをテストで検証する。
6. UI 部品は `client/src/components/uiParts` バレルからインポートし、client → common の一方向 import 境界を守る。
7. テストに「初期は展開」「クリックで折りたたみ→再クリックで展開」「aria-expanded の切り替わり」を追加。
8. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

### トグルボタン

- 見出し「コミュニティ」を表示している `Box`（`Typography` を含む）を `ListItemButton`（`uiParts` バレル既存）に置き換え、クリックで `setExpanded((prev) => !prev)` する。
- `aria-expanded={expanded}` を `ListItemButton` に付与する。アクセシブルな名前は見出しテキスト「コミュニティ」がそのまま使われる。
- 見出しテキストと chevron アイコンを横並びにするため、`ListItemText`（左）と chevron（右）を `ListItemButton` 内に配置し、テキストを `flexGrow` で押し広げる。

### chevron アイコン

- `@mui/icons-material` の `ExpandLess`（∧, 展開時）/ `ExpandMore`（∨, 折りたたみ時）を使う。これらは MUI アイコンであり既存方針（`ExploreIcon` を直接 import している）と同様にアイコンは直接 import で問題ない（`uiParts` バレルは `@mui/material` のコンポーネント用で、icons は対象外）。
- `expanded ? <ExpandLess /> : <ExpandMore />` で切り替える。

### Collapse による開閉

- 本体部（`List` 配下のコミュニティ一覧・「探す」リンク）を `Collapse` でラップする。
- `Collapse` は `in={expanded}` のとき開、`false` のとき閉。MUI `Collapse` は閉じても子要素を**アンマウントしない**（`unmountOnExit` 未指定時）。本体を非マウントにするため `unmountOnExit` を付け、折りたたみ時にコミュニティ一覧・「探す」リンクを DOM から消す。これによりテストで `queryByText(...).not.toBeInTheDocument()` で確実に判定できる（受け入れ条件 5 のテスト判定方法を「非マウント」に確定）。
- `Collapse` を `uiParts` バレルに追加し、そこから import する（直接 `@mui/material` を import しない既存方針）。

### import 境界

- client 内のコンポーネント改修のみ。common/server への依存追加・変更はない。一方向境界は維持される。

## 5. 影響範囲 / 変更ファイル

- **client** のみ
  - `client/src/components/uiParts/index.ts`: `Collapse` を `@mui/material/Collapse` から re-export 追加。
  - `client/src/components/SidebarCommunitySection.tsx`: 見出しをトグルボタン化、chevron 表示、本体を `Collapse`（`unmountOnExit`）でラップ、`useState` で開閉管理。
  - `client/src/components/SidebarCommunitySection.test.tsx`: 開閉トグルのテストを追加（既存テストはそのまま維持。展開初期状態のため既存「一覧表示」テストは引き続き通る）。
- **e2e**
  - `e2e/community/usecases.md`: `## UC-COMM-07` を追加。
  - `e2e/community/community.spec.ts`: 対応する `test.todo("UC-COMM-07: ...")` を追加。
  - `e2e/usecases.md`: community エリアのユースケース一覧サマリに UC-COMM-07 を反映。

## 6. テスト計画（TDD で書くテスト一覧）

`SidebarCommunitySection.test.tsx` に追加:

1. 初期状態は展開: トグルボタンの `aria-expanded` が `"true"`、コミュニティ一覧・「探す」が表示されている。
2. 見出しクリックで折りたたみ: クリック後、`aria-expanded` が `"false"` になり、コミュニティ名・「探す」が DOM から消える（`queryByText(...).not.toBeInTheDocument()`）。
3. 再クリックで再展開: もう一度クリックすると `aria-expanded` が `"true"` に戻り、コミュニティ名・「探す」が再表示される。

既存テスト（一覧表示・「探す」表示・ラベル表示）は初期展開のため変更不要で通る。

## 7. リスク・未決事項

- MUI `Collapse` はデフォルトでは閉じても子を残す。受け入れ条件 5（DOM 上で非表示 or 非マウント）を確実にテストするため `unmountOnExit` を付け「非マウント」方式に確定する。
- chevron アイコンは `@mui/icons-material` を直接 import する（既存 `ExploreIcon` と同様。`uiParts` バレルは `@mui/material` コンポーネント用で icons は対象外という既存運用に従う）。
