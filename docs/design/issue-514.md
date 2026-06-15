# 設計書: Issue #514 — モバイルドロワー内 nav の固定幅を撤廃しドロワー幅に追従させる

## 背景・目的

モバイル幅（md 未満）のサイドバードロワーで、内側 `Box component="nav"` に `width: SIDEBAR_WIDTH`(=260) が直接指定されていた。ドロワー paper は `sidebarStyles` で `width: SIDEBAR_WIDTH` + `p: 2`（左右計 32px）が設定され `box-sizing: border-box` のため、コンテンツ可用幅は 228px になる。しかし内側 nav の固定 260px がそれを超えており、ナビゲーション項目（特に「探す」等アイコン＋ラベルを持つ項目）が右端で見切れていた。

## 受け入れ条件の整理

1. モバイルドロワー内側 nav の `width: SIDEBAR_WIDTH` を `"100%"` に変更する
2. デスクトップの恒久サイドバー表示は従来どおり `SIDEBAR_WIDTH`(260) 幅で変化しない
3. ドロワーを開いたとき全ナビ項目のラベルが見切れず完全に表示される
4. 既存テストの更新 + 見切れ防止を担保する最小テストを追加
5. e2e usecases.md にモバイルドロワーのナビ項目が見切れず表示される期待動作を追記
6. `pnpm turbo run build test lint` が緑

## 実装方針

### 修正箇所

`client/src/routes/RootLayout.tsx` の 214-223 行目付近、モバイルドロワー内側の `Box component="nav"` の sx を変更:

```diff
- width: SIDEBAR_WIDTH,
+ width: "100%",
```

デスクトップの恒久サイドバーは `Box component="nav" sx={sidebarStyles}` のみで内側 nav を持たないため変更不要。

### テスト方針

TDD で進める:

1. **テスト追加**: モバイルドロワー内の `Box component="nav"` が固定ピクセル幅に依存しないことを確認するテストを追加
   - ドロワーを開いたとき、`role="navigation"` の要素に `style="width: 260px"` のようなインライン固定幅が付かないことをアサートする
   - 受け入れ条件: `aria-label="サイドバー"` の nav 要素が `width: 260px` の style を持たないこと

2. **テスト失敗確認**: 修正前に上記テストを実行して失敗することを確認
3. **実装**: `width: SIDEBAR_WIDTH` → `width: "100%"` へ変更
4. **テスト緑確認**: 既存テストと追加テストが全て緑になることを確認

### e2e ユースケース追記

`e2e/community/usecases.md` に UC-COMM-12 を追記（サイドバーのナビゲーションがモバイルドロワーで見切れない振る舞い）。
`e2e/usecases.md` のサマリにも反映。

## 考慮事項

- MUI の `Drawer` paper は `box-sizing: border-box` のため、`width: "100%"` にすることで padding 込みのコンテンツ幅に追従する
- テスト環境（jsdom + JSDOM 上の CSSOM）ではインラインスタイルのアサートが可能だが、MUI の sx は通常 CSS-in-JS として適用されるため、インラインスタイルではなく CSS クラスで適用される点に注意
- そのため、テストでは「style 属性に width の固定値がない」ではなく、動作ベースのアサート（nav が表示される、ナビ項目が nav 内に収まっている等）で担保するのが現実的
- 実装変更が 1 行の単純な fix のため、テストは振る舞い（ドロワーを開いたとき nav が表示される・ナビ項目が揃っている）のみ確認し、CSS 値の網羅的アサートは不要
