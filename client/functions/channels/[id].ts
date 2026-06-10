import {
  buildOgpMeta,
  buildOgpMetaHtml,
  findChannelInList,
  isCrawler,
  resolveApiBase,
  type ChannelLike,
  type OgpEnv,
} from "./ogp";

/**
 * `/channels/:id` 専用 Pages Function（#260 / ADR-0008 / ADR-0015）。
 *
 * クローラ（JS 非実行）に対しては `GET /api/channels` からチャンネル名を取得し、
 * `HTMLRewriter` で配信前 `index.html` の `<head>` に OGP `<meta>` を append して返す。
 * 通常ブラウザ・未知 channelId・API 失敗時は `next()`（素の SPA = 共通 OGP）にフォールバックする。
 *
 * `_middleware.ts`（Basic 認証）が先に走り、その後この Function が実行される。
 */
interface PagesContext {
  request: Request;
  env: OgpEnv;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}

/** `GET /api/channels` を叩いてチャンネル一覧を取得する。失敗時は null。 */
async function fetchChannels(apiBase: string): Promise<ChannelLike[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/channels`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return data.filter(
      (c): c is ChannelLike =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { id?: unknown }).id === "string" &&
        typeof (c as { label?: unknown }).label === "string",
    );
  } catch {
    return null;
  }
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env, params, next } = context;

  // クローラ以外（通常ユーザー）はそのまま SPA を配信する（既存動作の維持）。
  const userAgent = request.headers.get("user-agent");
  if (!isCrawler(userAgent)) {
    return next();
  }

  const channelId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!channelId) {
    return next();
  }

  const apiBase = resolveApiBase(env, request.url);
  const channels = await fetchChannels(apiBase);
  // API 失敗時は共通 OGP にフォールバック。
  if (!channels) {
    return next();
  }

  const channel = findChannelInList(channels, channelId);
  // 未知 channelId は共通 OGP にフォールバック。
  if (!channel) {
    return next();
  }

  const meta = buildOgpMeta({ channel, requestUrl: request.url });
  const metaHtml = buildOgpMetaHtml(meta);

  // 配信前の index.html を取得し、HTMLRewriter で <head> にチャンネル別 OGP を append する。
  const response = await next();
  // HTMLRewriter は Cloudflare Workers ランタイムのグローバル（型は @cloudflare/workers-types 由来）。
  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(metaHtml, { html: true });
      },
    })
    .transform(response);
};
