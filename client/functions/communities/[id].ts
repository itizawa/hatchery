import { buildOgpMetaHtml, isCrawler, resolveApiBase, type PagesContext } from "../shared/ogp";
import { buildCommunityOgpMeta, type CommunityLike } from "./ogp";

async function fetchCommunities(apiBase: string): Promise<CommunityLike[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/communities`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return data.filter(
      (c): c is CommunityLike =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { id?: unknown }).id === "string" &&
        typeof (c as { slug?: unknown }).slug === "string" &&
        typeof (c as { name?: unknown }).name === "string" &&
        typeof (c as { description?: unknown }).description === "string",
    );
  } catch {
    return null;
  }
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env, params, next } = context;

  const userAgent = request.headers.get("user-agent");
  if (!isCrawler(userAgent)) {
    return next();
  }

  const slug = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!slug) {
    return next();
  }

  const apiBase = resolveApiBase(env, request.url);
  const communities = await fetchCommunities(apiBase);
  if (!communities) {
    return next();
  }

  const community = communities.find((c) => c.slug === slug);
  if (!community) {
    return next();
  }

  const meta = buildCommunityOgpMeta({ community, requestUrl: request.url });
  const metaHtml = buildOgpMetaHtml(meta);

  const response = await next();
  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(metaHtml, { html: true });
      },
    })
    .transform(response);
};
