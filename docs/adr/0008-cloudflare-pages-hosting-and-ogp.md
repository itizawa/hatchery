# ADR-0008: ホスティング先（Cloudflare Pages）と SPA でのページ毎 OGP 方針

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #19

## コンテキスト（背景）

Hatchery のデプロイ先は、これまで ADR に明記されていなかった。ADR-0003（client 技術スタック）は
「Vite + React 19 の SPA / SSR なし」を決めたが、ホスティング先については「アプリ本体のデプロイ先は
本 ADR の範囲外。別途決定する」と保留していた。運用方針として **Cloudflare** にデプロイする方向が
固まってきたため、これを正式な技術決定として記録する。

あわせて、ADR-0003 の「SSR なし SPA」構成には既知の制約がある。SPA はビルド成果物の `index.html`
を全 URL で配信し、ページ固有の内容は **ブラウザ上の JS 実行後**に描画される。しかし OGP を読む
クローラ（Slackbot・X（Twitterbot）・`facebookexternalhit`・Discord 等）の多くは **JS を実行しない**。
そのため、どの URL をシェアしても **`index.html` に静的に書かれた共通の OGP（`og:title` /
`og:description` / `og:image`）しか届かず、ページ毎に異なる OGP をシェア面に出せない**。

この制約を放置すると、将来「ページ毎 OGP を出したい」となった際に「SSR フレームワーク（Next.js 等）へ
移行＝ ADR-0003 を覆す」という大きな判断に飛びつきかねない。本 ADR で「ホスティング先」と
「OGP 制約への対応方針」を同時に整理し、その論点を先に潰しておく。

## 決定

### 1. ホスティング先 = Cloudflare Pages

- client（ADR-0003）の Vite ビルド成果物（静的 SPA）を **Cloudflare Pages** に静的ホストする。
- ADR-0003 の「SSR なし SPA」を**維持**する。Cloudflare Pages は静的アセット配信に加え、必要なら
  Pages Functions（後述）をエッジで足せるため、SPA 構成のまま将来の拡張余地を残せる。

### 2. ページ毎 OGP の方針

- **MVP 段階では、OGP は `index.html` 共通で十分**とする。Hatchery のコア体験は「自分の会社の AI 社員を
  観察する」ループであり、ページ毎の URL シェア（特定チャンネル／シーンのシェア面最適化）は MVP の
  価値検証に含まれない。よって当面はページ毎 OGP を実装しない。
- **将来ページ毎 OGP が必要になった場合**は、**Cloudflare Pages Functions + `HTMLRewriter`**
  （Cloudflare Workers ランタイムの標準 API・追加ライブラリ不要）で対応する。リクエスト URL に応じて
  配信前の `index.html` の `<meta>`（OGP タグ）をエッジで書き換える方式を採る。これにより
  **クローラには URL 毎に正しい OGP を返しつつ、通常ユーザーには従来どおり SPA を配信**できる。
- **SSR フレームワーク（Next.js 等）への移行は不要**。OGP のためだけに ADR-0003（SSR なし SPA）を
  覆さない。OGP はエッジでの `<meta>` 後付けという限定的・追加的な手段で解決できる。

## 理由

- **Cloudflare Pages**: 静的 SPA の無料〜低コストなグローバル配信に適し、CDN・TLS・カスタムドメインが
  標準。さらに **Pages Functions（Workers）をエッジで併用**でき、「普段は純粋 SPA、必要な部分だけ
  エッジで動的処理」という段階的拡張が同一プラットフォームで完結する。OGP 後付けの逃げ道を確保しつつ、
  今は SPA のまま運用できる点が決め手。
- **`HTMLRewriter` での OGP 後付け**: Workers 標準のストリーミング HTML 変換 API で、追加依存なしに
  `index.html` の `<meta>` だけを URL に応じて差し替えられる。SSR のようにアプリ全体をサーバ描画する
  必要がなく、変更範囲がエッジの薄い層に閉じる。SPA の単純さ（ADR-0003）を保てる。
- **SSR 化を避ける**: SSR/SSG への移行はビルド・実行・状態管理の複雑性を全面的に引き上げる。得たいのは
  「クローラに正しい `<meta>` を返す」ことだけなので、エッジでの `<meta>` 書き換えという最小手段が
  目的に対して過不足ない。

## 検討した代替案

- **Vercel / Netlify の自動プリレンダリング（クローラ向け prerender）**: クローラ検出時に
  プリレンダリング済み HTML を返す仕組みを持つ（あるいはアドオンで提供）。OGP 問題は緩和できるが、
  (1) ホスティングを Cloudflare に寄せる本決定と分散し、(2) プリレンダリング挙動がプラットフォーム
  依存のブラックボックスになりやすい。Cloudflare Pages Functions + `HTMLRewriter` なら同一基盤上で
  挙動を明示的に制御できるため不採用。
- **SSR / SSG への移行（Next.js 等）**: ページ毎 OGP もルーティングも一挙に解決するが、ADR-0003
  （SSR なし SPA）を覆し、複雑性とビルド/実行コストが大幅に増える。MVP に不要な重装備であり、OGP は
  エッジでの `<meta>` 後付けで足りるため不採用。
- **react-helmet 等によるクライアント側 `<meta>` 動的更新のみ**: JS 実行後に `<meta>` を書き換えるが、
  クローラの多くは JS を実行しないためシェア面には届かない。OGP 問題の解決にならず不採用（ユーザー向け
  タイトル更新の補助としては併用可）。
- **ビルド時 SSG で URL 毎に静的 HTML を量産**: シーンは定時生成で増減し URL が動的なため、ビルド時に
  全 URL 分の HTML を事前生成するのは現実的でない。エッジ動的書き換えの方が適する。不採用。

## 影響（結果）

- 良い影響: デプロイ先が Cloudflare Pages に確定し、ADR-0003 の SPA 構成を維持したまま運用できる。
  将来 OGP が必要になっても、SSR 化（ADR-0003 の覆し）ではなく Pages Functions + `HTMLRewriter` の
  追加で対応できる道筋が明確になり、設計判断の手戻りを防げる。
- トレードオフ / 注意点: MVP 段階ではページ毎 OGP が出ない（`index.html` 共通の OGP のみ）。これは
  MVP のコア体験に影響しないため許容する。OGP 後付けを実装する際は Pages Functions のテスト・
  デプロイ設定が追加で必要になる。
- フォローアップ:
  - Cloudflare へのデプロイパイプライン（CI/CD）の構築は別 Issue。
  - ページ毎 OGP（Pages Functions + `HTMLRewriter`）の実装、および動的 OGP 画像（`og:image`）生成は
    必要になった時点で別 Issue を起票する。
  - 本 ADR は ADR-0003 を**覆さない**（SSR なし SPA を維持）。ADR-0003 自体は変更しない。
