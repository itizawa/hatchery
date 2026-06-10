/**
 * チャンネル別 OGP 動的生成（#260 / ADR-0008 / ADR-0015）のロジック中核。
 *
 * Cloudflare Pages Functions の `HTMLRewriter` は Workers ランタイム専用で node/jsdom には
 * 存在しないため、テスト可能な純粋関数をここに分離する（`[id].ts` 本体はこれらを組み合わせる）。
 */

/** `GET /api/channels` の要素のうち本機能が使う最小形（id / label）。 */
export interface ChannelLike {
  id: string;
  label: string;
}

/** Pages Functions の環境変数バインディング（API のオリジン）。 */
export interface OgpEnv {
  /** API（server）のベース URL。クロスオリジン配信時に設定する（未設定なら同一オリジン）。 */
  API_BASE_URL?: string;
}

/**
 * OGP を読むクローラ（JS 非実行）の User-Agent 判定。
 * `bot` / `Twitterbot` / `Slackbot` / `facebookexternalhit` 等を大文字小文字無視で含めば true。
 */
const CRAWLER_UA_PATTERNS = [
  "bot",
  "facebookexternalhit",
  "embedly",
  "quora link preview",
  "outbrain",
  "pinterest",
  "slack",
  "vkshare",
  "w3c_validator",
  "redditbot",
  "applebot",
  "whatsapp",
  "flipboard",
  "tumblr",
  "bitlybot",
  "skypeuripreview",
  "nuzzel",
  "discord",
  "google page speed",
  "qwantify",
  "telegrambot",
];

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

/** チャンネル一覧から id 一致の要素を返す（未一致は undefined）。 */
export function findChannelInList<T extends { id: string }>(
  channels: readonly T[],
  id: string,
): T | undefined {
  return channels.find((channel) => channel.id === id);
}

/** OGP メタの構築結果。 */
export interface OgpMeta {
  title: string;
  description: string;
  url: string;
}

/** チャンネルとリクエスト URL から OGP メタ値を組み立てる。 */
export function buildOgpMeta(args: { channel: ChannelLike; requestUrl: string }): OgpMeta {
  const { channel, requestUrl } = args;
  return {
    title: `${channel.label} - Hatchery`,
    description: `「${channel.label}」チャンネルでの AI ワーカーたちの会話を観察しよう。 | Hatchery`,
    url: requestUrl,
  };
}

/**
 * API のベース URL を解決する。`env.API_BASE_URL` を優先（末尾スラッシュ除去）、
 * 未設定/空なら同一オリジン（リクエスト URL の origin）を返す。
 */
export function resolveApiBase(env: OgpEnv, requestUrl: string): string {
  const configured = env.API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(requestUrl).origin;
}

/** HTML 属性値に注入する文字列を最小限エスケープする（属性インジェクション防止）。 */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OGP メタを `<head>` に append するための HTML 文字列を生成する。 */
export function buildOgpMetaHtml(meta: OgpMeta): string {
  const title = escapeHtmlAttr(meta.title);
  const description = escapeHtmlAttr(meta.description);
  const url = escapeHtmlAttr(meta.url);
  return [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ].join("");
}
