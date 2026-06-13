# 設計書: Cloudflare Web Analytics を client に導入する (#439)

## 1. 目的 / 背景

ADR-0026 で採用した **Cloudflare Web Analytics** のビーコンを client（Vite + React 19 SPA / Cloudflare Pages）に組み込み、本番で PV/UU と **SPA ルート遷移**が計測される状態にする。本 Issue は ADR-0026 の「フォローアップが必要なこと」（実際のタグ埋め込み・ルート遷移計測の実装）にあたる。

前提:
- Cloudflare ダッシュボードでの Web Analytics 有効化・ビーコントークン発行はインフラ側の人手作業（本 Issue のコード外）。
- トークンはコードにハードコードせず、ビルド時に環境変数 `VITE_CF_BEACON_TOKEN` で注入する。トークン未発行でもコードは未設定時 no-op としてマージ可能。

## 2. スコープ（やること / やらないこと）

**やること**:
- `client/index.html` の `<head>` に Cloudflare Web Analytics ビーコン `<script>` のプレースホルダを置き、`client/vite.config.ts` の `transformIndexHtml`（`%VITE_OGP_URL%` 置換と同方式・#256）で env からトークンを注入する。未設定なら `<script>` を一切出力しない。
- TanStack Router のルート遷移完了を契機に Cloudflare ビーコンへ page ビューを通知する仕組みを実装する。
- トークン未設定（`window.__cfBeacon` 不在）時に通知コードが例外を投げず no-op になるガードを実装する。
- `VITE_CF_BEACON_TOKEN` の用途・設定方法・Cookie/GDPR 不要の旨を `client/README.md` に文書化する。

**やらないこと**（ADR-0026 / Issue 補足のスコープ外）:
- カスタムイベント計測（vote / 購読などの個別アクション）、ファネル分析・セッションリプレイ、ダッシュボード運用フロー整備。
- server / common のコード変更（変更は client と docs に閉じる）。
- Cloudflare ダッシュボードでのトークン発行・有効化（インフラ人手作業）。

## 3. 設計判断

### 3-1. SPA 計測方式: 「TanStack Router 購読 → 手動 `window.__cfBeacon` 通知」を採用

Cloudflare Web Analytics の SPA 自動モード（beacon の `spa` オプション）も候補だが、ADR-0026 が手動方式を明記しており、かつ「`router.subscribe("onResolved")` 相当のフックで遷移ごとに 1 回通知が発火する」ことをユニットテストで検証する受け入れ条件 #2 を満たすには、**ルータ購読から明示的に `window.__cfBeacon.push({ type: "page" })` を呼ぶ手動方式**が最も素直でテスト可能。自動モードは内部の history 監視に依存し、ユニットテストで呼び出し回数を assert しにくい。よって手動方式を採用する。

### 3-2. 通知ユーティリティ `notifyCfPageView` を `client/src/analytics/` に切り出す

`window.__cfBeacon` の存在ガードと `push` 呼び出しを純粋な薄いユーティリティ関数 `notifyCfPageView()` に隔離する。これにより:
- `window.__cfBeacon` をスタブ化して呼び出し回数・引数を assert できる（受け入れ条件 #2）。
- `window.__cfBeacon` 不在時に no-op になることを単体テストできる（受け入れ条件 #3）。

`window.__cfBeacon` の型は `client/src/analytics/cfBeacon.ts` で `Window` インターフェース拡張として宣言する（`declare global`）。

### 3-3. ルータ購読は `createAppRouter` 内ではなくフックで行う

ルート遷移の購読は副作用であり、`createAppRouter`（純粋なルータ生成）に混ぜると memory history を使う既存テストで意図せず通知が走る。代わりに `client/src/analytics/useCfPageViewTracking.ts` の `useCfPageViewTracking(router)` フックを新設し、`AppRoot` で呼ぶ。フック内で `router.subscribe("onResolved", ...)` を購読し、**初回ロード（マウント時の最初の onResolved）を除く各遷移ごとに 1 回** `notifyCfPageView()` を呼ぶ。クリーンアップで unsubscribe する。

> 初回ロードのページビューはビーコンスクリプト本体が自動計測するため、SPA 遷移計測では初回を除外して二重計上を避ける（受け入れ条件 #2「初回ロードを除く各ルート遷移ごとに 1 回」）。

### 3-4. env 注入: `transformIndexHtml` でプレースホルダ全置換

`client/index.html` の `<head>` に `%VITE_CF_BEACON_TOKEN_SCRIPT%` の 1 行プレースホルダを置く。vite プラグイン `cfBeaconHtmlPlugin` が:
- `process.env.VITE_CF_BEACON_TOKEN?.trim()` が空でなければ、`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"<token>"}'></script>` に置換。
- 空（未設定）なら空文字に置換し、`<script>` を残さない。

これにより「設定時は token 入りで出力 / 未設定時は出力しない」を満たす。トークンは JSON 内に埋め込むため、`"` / `\` を含む不正トークンで壊れた HTML を生成しないよう `JSON.stringify` で token をエスケープして埋め込む。

## 4. 受け入れ条件 → テスト対応

| 受け入れ条件 | テスト |
|---|---|
| #1 token 設定時は beacon script 出力 / 未設定時は出力しない（vite プラグイン単体） | `client/vite.config.test.ts`: `cfBeaconHtmlPlugin` の `transformIndexHtml` を token あり/なしで呼び、出力 HTML を assert |
| #2 SPA ルート遷移ごとに 1 回 page 通知（初回除く） | `client/src/analytics/useCfPageViewTracking.test.tsx`: memory history のルータを描画し `window.__cfBeacon` をスタブ、`router.navigate` で遷移→ push 呼び出し回数・引数を assert |
| #3 token 未設定（`window.__cfBeacon` 不在）でも例外を投げず no-op | `client/src/analytics/cfBeacon.test.ts`: `window.__cfBeacon` 不在で `notifyCfPageView()` が throw しない |
| #4 文書化 | `client/README.md` に追記（テスト対象外） |
| #5 build/test/lint 緑・client/docs に閉じる・import 境界 | CI（`pnpm turbo run build test lint`） |

## 5. 影響範囲 / 既存への変更

- 追加: `client/vite.config.test.ts`, `client/src/analytics/cfBeacon.ts`, `client/src/analytics/cfBeacon.test.ts`, `client/src/analytics/useCfPageViewTracking.ts`, `client/src/analytics/useCfPageViewTracking.test.tsx`, `client/README.md`, `docs/design/issue-439.md`
- 変更: `client/index.html`（プレースホルダ追加）, `client/vite.config.ts`（プラグイン追加 + export）, `client/src/AppRoot.tsx`（フック呼び出し追加）, `client/src/vite-env.d.ts`（`VITE_CF_BEACON_TOKEN` の型補完は任意）
- import 境界: client 内に閉じる。server / common へ依存しない。

## 6. e2e ユースケース

アクセス解析ビーコンは**ユーザーに観察可能な振る舞いの変化を持たない**（画面・遷移・操作結果は不変。ビーコンは不可視で、未設定環境では何も起きない）。CLAUDE.md「e2e ユースケースの保守」の規定により、ユーザー可視挙動が変わらないため `e2e/` の更新は不要（PR に一言残す）。

## 7. リスク・未決事項

- ビルド時に `VITE_CF_BEACON_TOKEN` を渡す GitHub Actions（`deploy-client-*.yml`）への env 追加は、トークン発行（インフラ作業）後に別途行う想定。本 Issue ではコード側を未設定時 no-op で安全にし、README に設定手順を残すまでをスコープとする。
