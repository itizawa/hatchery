# 設計書: プロダクトの魅力を伝えるランディングページ (LP) を追加する (#167)

## 1. 目的 / 背景

現状 client には未ログインユーザー向けにプロダクトの価値を伝える導線が無い。初見の訪問者がいきなり機能画面 / ログインに着地してしまう。`concept.md` に沿った Hatchery の魅力（同じ顔ぶれが継続して記憶でキャラが立つ／定時にだけ動く／覗くと変化が育つ＝観察→関与→変化の実感ループ）を一目で伝えるランディングページ (LP) を追加し、ログインへ誘導できる状態にする。

## 2. スコープ（やること / やらないこと）

### やること
- `LandingScene`（`client/src/routes/LandingScene.tsx`）を新規追加（MUI v6 + Emotion・既存 `theme.ts` に馴染ませる）。
- 新ルート `/lp`（認証不要・サイドバーなし）を `client/src/router.tsx` に登録（`isAuthLayout` の分岐に `/lp` を追加）。
- LP の内容: ヒーロー（プロダクト名＋キャッチコピー）／中核の魅力 3 点／`/login` への CTA。
- テスト（RTL + jsdom）: `LandingScene` のコンテンツ検証 + router レベルで `/lp` がサイドバーなしで描画されることの検証。
- Storybook story（`LandingScene.stories.tsx`）。

### やらないこと
- 入力フォーム（メール収集・ニュースレター）の追加（Zod `.max()` 規約は本 Issue 非該当）。
- 多言語対応・SEO メタタグ・OGP・アニメーション・`/signup` 接続。
- `/` の `HomeFeedScene` の差し替え・変更（既存ホームは温存）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `LandingScene` をレンダリングすると、ヒーローにプロダクト名「Hatchery」とキャッチコピー相当の見出しが表示される。
2. 中核の魅力 3 点 (a) 同じ顔ぶれが継続し記憶でキャラが立つ、(b) 定時にだけ動く、(c) 覗くと変化が育つ、の各文言が表示される。
3. `/login` へ遷移する CTA（リンク）が表示される（TanStack Router の `<Link to="/login">`）。
4. router レベルで `/lp` を開くと `LandingScene` が描画され、サイドバー（`role="navigation"` name=サイドバー）が存在しない。
5. `pnpm turbo run build / test / lint` が全緑。一方向 import 境界に違反しない。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `LandingScene` は presentational なコンポーネント。データ取得なし（TanStack Query 不要）。MUI の `Box` / `Stack` / `Typography` / `Button` と TanStack Router の `Link` で構成。
- CTA は TanStack Router の `<Link to="/login">` を MUI `Button` の `component` として用いる（`<Button component={Link} to="/login">`）。これにより SPA 遷移かつアクセシブルな `role="link"`。
- ルート登録は既存の `loginRoute` に倣い `lazyRouteComponent` で動的 import。`isAuthLayout(pathname)` に `pathname === "/lp"` を追加してサイドバーなし（`AuthLayout`）で描画する。
- 魅力 3 点はデータ配列（`FEATURES`）として定義し `map` で描画。テストは各 `title` 文言で検証する。
- コピーは `concept.md`（TL;DR の 3 要点・コンセプト・中核価値）に基づく。ユーザー入力フィールドは増やさないので `.max()` 規約は非該当。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- 新規: `client/src/routes/LandingScene.tsx`、`client/src/routes/LandingScene.stories.tsx`、`client/src/routes/LandingScene.test.tsx`。
- 変更: `client/src/router.tsx`（`isAuthLayout` に `/lp` 追加、`lpRoute` 定義・`addChildren` 追加、`LazyLandingScene`）、`client/src/router.test.tsx`（`/lp` のサイドバーなし検証を追加）。
- server / common / docs への変更なし（docs Storybook は client の `*.stories.tsx` を取り込むため story 追加のみで反映）。

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/routes/LandingScene.test.tsx`（コンポーネント単体・Router でラップ）:
- ヒーローにプロダクト名「Hatchery」見出しが表示される。
- キャッチコピー相当の文言が表示される。
- 魅力 3 点 (a)(b)(c) の各文言が表示される。
- `/login` への CTA リンク（`role="link"`、href=/login）が表示される。

`client/src/router.test.tsx`（既存パターンに追加）:
- `/lp` を開くと LP の見出しが描画され、サイドバー（navigation サイドバー）が存在しない。

## 7. リスク・未決事項

- Issue 本文は `HomeScene` と記載するが、実ファイルは `HomeFeedScene`（`/` ルート）。`/` は変更しない方針は同一。
- `<Button component={Link}>` の型: TanStack Router の `Link` を MUI `component` に渡す際の props 型は既存実装に倣い問題ないことを lint / build で確認する。問題があれば MUI `Link` + `component={RouterLink}` 構成にフォールバック。
