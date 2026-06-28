# 設計書: fix: モバイル（sm未満）でコミュニティ概要（description）が非表示になる (#883)

## 1. 目的 / 背景

`client/src/components/CommunityHeader.tsx` の description 表示に `sx={{ display: { xs: "none", sm: "block" } }}` が設定されており、モバイル（xs = 600px 未満）でコミュニティの説明が一切表示されない。右サイドバー（CommunitySidebarCard）も md 未満で非表示のため、モバイルユーザーは description を確認できる場所が完全に存在しない状態。

## 2. スコープ（やること / やらないこと）

**やること:**
- `CommunityHeader.tsx` の description Typography の `sx` を `display: "block"` に変更してモバイルでも表示する
- 長い description の折り返し表示（MUI Typography のデフォルト `word-break: break-word` を活用）
- テストで description の DOM 存在確認を追加

**やらないこと:**
- 右サイドバー（CommunitySidebarCard）のモバイル表示対応（スコープ外・別 Issue）
- 長い description への line-clamp 制限（Issue 要件は「折り返し」で十分とされている）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityHeader` に description がある場合、テキストが DOM に存在する
2. `CommunityHeader` に description が null の場合、description テキストが DOM に存在しない
3. `CommunityHeader` に description が空文字の場合、description テキストが DOM に存在しない
4. `pnpm --filter @hatchery/client test` が緑
5. `pnpm lint` が緑（ESLint・TypeScript エラーなし）

## 4. 設計方針

### 変更箇所

`client/src/components/CommunityHeader.tsx:93`

**変更前:**
```tsx
sx={{ display: { xs: "none", sm: "block" } }}
```

**変更後:**
```tsx
// sx prop 自体を削除（MUI Typography のデフォルト display: block を使う）
```

description の `Typography` から `sx` の display 指定を完全に削除する。MUI の `Typography` はデフォルトで `display: block`（または `display: initial`）であり、xs 非表示を指示している sx のみが問題の原因。`sx` prop 自体を除去することで最小変更で修正できる。

### テスト方針

jsdom の `css: false` 設定により、MUI の Emotion 生成 CSS に基づくレスポンシブ表示（media query）を jsdom で直接検証することはできない。そのため：
- DOM への description テキストの存在確認（`getByText` / `toBeInTheDocument`）を追加
- null・空文字時の非描画を確認
- これらは回帰テストとして機能する（CSS display の変更による副作用を検出）

## 5. 影響範囲 / 既存への変更

- **対象ワークスペース**: `client` のみ
- **変更ファイル**: `client/src/components/CommunityHeader.tsx`（1 行変更）
- **テスト追加**: `client/src/components/CommunityHeader.test.tsx`
- デスクトップ（sm 以上）での表示変化なし（元々 `sm: "block"` で表示されていた）

## 6. テスト計画（TDDで書くテスト一覧）

| # | テスト内容 | ファイル |
|---|-----------|----------|
| 1 | description がある場合に DOM に description テキストが存在する (#883) | CommunityHeader.test.tsx |
| 2 | description が null の場合に description テキストが DOM に存在しない | CommunityHeader.test.tsx |
| 3 | description が空文字の場合に description テキストが DOM に存在しない | CommunityHeader.test.tsx |

## 7. リスク・未決事項

- jsdom の `css: false` 設定により、media query に基づくレスポンシブ CSS のユニットテストが不可能。実際のモバイル表示確認は E2E（Playwright）または手動確認が必要。
- 長い description テキスト（数百文字以上）がモバイルレイアウトを崩す可能性があるが、MUI Typography はデフォルトで `word-break: normal` と折り返しを持つため問題ない見込み。
