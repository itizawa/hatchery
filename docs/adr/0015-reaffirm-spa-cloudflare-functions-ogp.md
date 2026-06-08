# ADR-0015: 公開チャンネルの OGP/SEO を Next.js 移行ではなく Cloudflare Pages Functions で実現する

- ステータス: Accepted
- 日付: 2026-06-08
- 関連 Issue: #247, #248, #249

## コンテキスト（背景）

「公開チャンネルを認証なしで閲覧・SNS シェアでき、ページ毎の OGP を出し、検索エンジンにも
インデックスされるようにしたい」という要件が生まれた。当初この要件に対し、client を Vite SPA から
**Next.js App Router へ全面移行**し（#247）、公開チャンネルを SSG で配信（#248）、ホスティングを
Cloudflare Pages から **GCP Cloud Run へ移行**する（#249）計画を立てた。これは ADR-0003
（SSR なし SPA）および ADR-0008（Cloudflare Pages ホスティング / OGP はエッジ後付け）を覆す決定だった。

しかし改めて検討した結果、**この要件は ADR-0008 が当初から逃げ道として用意していた
「Cloudflare Pages Functions + `HTMLRewriter`」で充足でき、Next.js 移行・Cloud Run 移行は
不要**との結論に至った。要件を「OGP / キャッシュ / SEO」の 3 軸で分解すると次のとおり:

- **OGP（JS 非実行クローラ向けのページ毎 `<meta>`）**: ADR-0008 §2 が明記したとおり、Pages Functions
  + `HTMLRewriter` で配信前 `index.html` の `<meta>` を URL 別に書き換えればよい。追加ライブラリ不要。
- **キャッシュ戦略**: #249 が挙げたキャッシュ要件（静的アセットの immutable 永続キャッシュ、公開ページの
  TTL キャッシュ、バッチ後の Cache Purge）はホスティング層の機能であり、Next.js 固有ではない。
  Cloudflare Pages がエッジキャッシュを標準提供し、Functions の応答に `Cache-Control` を付与し、
  Cache Purge API で破棄できる。
- **SEO（検索インデックス）**: 公開チャンネルに求める SEO 水準は「OGP シェア面が機能し、Google に
  インデックスされれば十分」とした（Googlebot は JS をレンダリングして SPA を索引できる）。本文を初期
  HTML に含めた静的 HTML での堅牢な SEO は MVP の必須要件ではない。

Next.js / Cloud Run 移行は、(1) client の全面書き換え（ルーティング・認証 middleware・MUI/Emotion の
SSR ThemeRegistry・テスト基盤・env）、(2) 無料・静的な Cloudflare Pages を捨てて Node サーバ
（Cloud Run のコールドスタート・運用コスト・Dockerfile・デプロイワークフロー 2 本）を抱える、という
大きな複雑性とコストを伴う。公開チャンネルシェアは Hatchery のコア体験（観察 → 関与 → 変化の実感）の
**周辺機能**であり、その対価に見合わない。

## 決定

**Next.js 移行（#247）・Cloud Run 移行（#249）は行わない。** ADR-0003（SSR なし SPA）と
ADR-0008（Cloudflare Pages ホスティング）を**維持・再確認**し、公開チャンネルの OGP/SEO は
Cloudflare Pages Functions + `HTMLRewriter` で実現する。

- client は **Vite + React 19 SPA のまま**とし、ホスティングは **Cloudflare Pages** を継続する。
- 公開チャンネル（#248）は、認証なし取得 API（server 側 `GET /channels/:id/public`・`isPublic` フラグ）
  と、Cloudflare Pages Functions による配信前 `index.html` の OGP `<meta>` 書き換えで実現する。
- 公開チャンネルページの応答に `Cache-Control`（例: `s-maxage` + `stale-while-revalidate`）を付与して
  エッジキャッシュし、定時バッチ完了後に **Cloudflare Cache Purge API** で対象 URL のキャッシュを破棄する。
- SEO は OGP + Googlebot の JS レンダリングに委ねる。静的 HTML 本文でのインデックスは MVP 要件外とする。

## 理由

- **要件充足に十分な最小手段**: 得たいのは「ページ毎の正しい OGP」「公開チャンネルの認証なし閲覧」
  「バッチ更新を反映するキャッシュ」であり、いずれも SPA + エッジ（Pages Functions）の薄い層で実現できる。
  SSR/SSG というアプリ全体のサーバ描画は目的に対して過剰。
- **既存資産の温存**: Vite SPA・TanStack Router・TanStack Query・型安全 API クライアントをそのまま使え、
  全面書き換えのリスク・工数を回避できる。
- **コスト・運用の単純さ**: 無料・静的な Cloudflare Pages を維持でき、Cloud Run のコールドスタートや
  サーバ運用を持ち込まない。MVP 規模では無料枠内に収まる見込み。
- **ADR の一貫性**: ADR-0003 / ADR-0008 を覆さずに済み、設計判断の手戻りを防げる。ADR-0008 が
  予め用意していた逃げ道（Pages Functions + `HTMLRewriter`）を、想定どおりのタイミングで発動するだけ。

## 検討した代替案

- **Next.js App Router 全面移行 + Cloud Run（#247 + #249）**: ページ毎 OGP・SSG・SEO を一挙に解決できるが、
  ADR-0003 / ADR-0008 を覆し、client 全面書き換えと Node サーバ運用（Cloud Run）という複雑性・コストを
  招く。要件は SPA + エッジで足りるため不採用。本 ADR の主たる却下対象。
- **Pages Functions で本文まで含めたエッジ SSR（簡易 SSR）**: `HTMLRewriter` で `<meta>` だけでなく body にも
  コンテンツを流し込めば静的 HTML 本文での SEO を強化できるが、手製の簡易 SSR に近づき複雑性が増す。
  求める SEO 水準（OGP + Google の JS レンダリング）には不要なため、現時点では不採用（将来要件が上がれば再検討）。
- **クライアント側 `<meta>` 動的更新のみ（react-helmet 等）**: JS 非実行クローラに届かず OGP 解決にならない。
  ユーザー向けタイトル更新の補助としては併用可（ADR-0008 と同じ整理）。

## 影響（結果）

- 良い影響: client の全面書き換え・ホスティング移行を回避し、ADR-0003 / ADR-0008 を維持したまま公開チャンネルの
  OGP/SEO/キャッシュ要件を満たせる。無料・静的ホスティングの単純さとコスト優位を保てる。
- トレードオフ / 注意点:
  - 公開チャンネル本文は初期 HTML に含まれず、Google のインデックスは JS レンダリングに依存する
    （索引の即時性・確実性は静的 HTML に劣る）。MVP では許容。将来、確実な静的 HTML SEO が必須化したら
    エッジ SSR or SSG を別途検討する（その際は本 ADR を supersede する）。
  - Pages Functions（OGP 書き換え・キャッシュヘッダ・Cache Purge 連動）のテスト・デプロイ設定が追加で必要。
- フォローアップ:
  - #247（Next.js 移行）・#249（Cloud Run 移行）はクローズする。
  - #248（公開チャンネル）は Next.js SSG ベースから Pages Functions + `HTMLRewriter` ベースへ受け入れ条件を
    再定義する。
  - 本 ADR は ADR-0003 / ADR-0008 を**覆さない**（再確認する）。両 ADR 自体は変更しない。
