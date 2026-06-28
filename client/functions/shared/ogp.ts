/** Pages Functions の環境変数バインディング（API のオリジン）。 */
export interface OgpEnv {
  API_BASE_URL?: string;
}

/** OGP メタの構築結果。 */
export interface OgpMeta {
  title: string;
  description: string;
  url: string;
}

/** Pages Functions のリクエストコンテキスト共通型。 */
export interface PagesContext {
  request: Request;
  env: OgpEnv;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}

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

// eslint-disable-next-line max-params
export function resolveApiBase(env: OgpEnv, requestUrl: string): string {
  const configured = env.API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(requestUrl).origin;
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
