# 設計書: e2e/community の UC-COMM-11〜13,15 を Playwright テストとして実装する (#742)

## 1. 目的 / 背景

`e2e/community/community.spec.ts` の 4 件の `test.todo()` が未実装のままである。コミュニティ閲覧は Hatchery の主要フローであり、リリース判定（`/release-check`）で検証できるよう実テストへ置き換える。

- UC-COMM-11: 投稿一覧での本文省略表示（line-clamp）
- UC-COMM-12: モバイルドロワーのナビ項目見切れなし
- UC-COMM-13: コミュニティ一覧の活気指標（投稿数・最終投稿時刻）
- UC-COMM-15: カード/コンパクト切り替え（廃止済みのためスキップ）

## 2. スコープ（やること / やらないこと）

### やること
- 上記 4 件の `test.todo()` を実テストへ書き換える
- UC-COMM-15 は Issue #811 でコンパクト表示が廃止済みのため `test.skip()` にする
- UC-COMM-12 はモバイルビューポート（375px）で `page.setViewportSize` を使う

### やらないこと
- 既存テスト（UC-COMM-01〜10, 16）の変更
- クライアントの実装コード変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. **UC-COMM-11**: 長い本文の投稿カードで `overflow: hidden` が CSS で適用されている（`WebkitLineClamp: 3` による省略）ことを DOM 属性で確認する。
2. **UC-COMM-12**: ビューポート 375px でハンバーガーボタンをクリックしたとき、ドロワーが開き、主要ナビ項目（ホーム・人気・利用規約・プライバシーポリシー）が `toBeVisible()` で確認できる。
3. **UC-COMM-13**: `/communities` に `post_count > 0` のコミュニティは「N件の投稿」と「最終投稿:」テキストが表示され、`post_count === 0` のコミュニティは「投稿なし」と「未投稿」が表示される。
4. **UC-COMM-15**: `test.skip(true, "コンパクト表示モードは Issue #811 で廃止済みのためスキップ")` で明示的スキップ。
5. `pnpm turbo run build lint test` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### UC-COMM-11 の検証方法
- `PostCard` が `truncateText` prop を受け取ると、本文要素に `WebkitLineClamp: 3` と `overflow: "hidden"` が適用される（`client/src/components/PostCard.tsx` l.173-175）。
- `CommunityScene` では `truncateText` を常に渡している（`client/src/routes/CommunityScene.tsx` l.100）。
- 本文要素を `page.locator()` で特定し、`evaluate()` で `getComputedStyle().overflow` が `hidden` であることを確認するか、インラインスタイルの `overflow` 属性を確認する。
- または `innerHTML` や `textContent` が本文全体と一致しないことを確認する（文字列が切れていることを検証）。

### UC-COMM-12 の検証方法
- `page.setViewportSize({ width: 375, height: 812 })` でモバイルビューポートに設定。
- aria-label="メニューを開く" ボタンをクリックしてドロワーを開く。
- `data-testid="mobile-sidebar-nav"` でモバイルサイドバーを特定。
- 主要ナビ項目（ホーム・人気・ランキング・利用規約・プライバシーポリシー）の各リンク/ボタンが `toBeVisible()` で確認。

### UC-COMM-13 の検証方法
- 2 つのモックコミュニティを用意（投稿ありと投稿なし）。
- 投稿ありのカードに「N件の投稿」「最終投稿:」テキストが含まれることを確認。
- 投稿なしのカードに「投稿なし」「未投稿」テキストが表示されることを確認。

### UC-COMM-15
- `test.skip(true, "...")` で明示的にスキップ（home-feed の UC-HOME-16 と同じパターン）。

### モックデータ
既存の `MOCK_COMMUNITY` を活用しつつ、UC-COMM-13 用に `post_count: 0` / `last_post_at: null` のコミュニティも追加。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: なし（e2e テストのみ）
- 変更ファイル: `e2e/community/community.spec.ts`（test.todo() 4 件を置き換え）

## 6. テスト計画（TDD で書くテスト一覧）

| ID | テスト概要 | 検証方法 |
|----|-----------|---------|
| UC-COMM-11 | 本文省略の CSS overflow=hidden | `evaluate()` で computedStyle 確認 |
| UC-COMM-12 | モバイルドロワー全ナビ項目が見える | `toBeVisible()` で各ナビ項目確認 |
| UC-COMM-13 | 活気指標の表示（投稿あり・なし） | `toContainText()` で文字列確認 |
| UC-COMM-15 | コンパクト表示廃止スキップ | `test.skip()` |

## 7. リスク・未決事項

- UC-COMM-11: 本文要素のセレクタは `PostCard` の実装を確認して決定する（`truncateText` 時の本文 Box 要素）。`evaluate()` で `computedStyle` を取得する際に Playwright の実行タイミングに注意。
- UC-COMM-12: `SidebarContent` は `QueryBoundary` でラップされており、MSW の `auth/me` モックが必要。コミュニティ一覧 API も必要になる可能性。
- UC-COMM-15: スキップのみなので実装リスクなし。
