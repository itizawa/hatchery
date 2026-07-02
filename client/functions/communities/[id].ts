import { OGP_META_SELECTORS_TO_REMOVE, buildOgpMetaHtml, isCrawler, resolveApiBase, type PagesContext } from "../shared/ogp";
import { buildCommunityOgpMeta, type CommunityLike } from "./ogp";

async function fetchCommunities(apiBase: string): Promise<CommunityLike[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/communities`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return data
      .filter(
        (c: unknown): c is Record<string, unknown> =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).id === "string" &&
          typeof (c as Record<string, unknown>).slug === "string" &&
          typeof (c as Record<string, unknown>).name === "string" &&
          typeof (c as Record<string, unknown>).description === "string",
      )
      .map((c): CommunityLike => ({
        id: c.id as string,
        slug: c.slug as string,
        name: c.name as string,
        description: c.description as string,
      }));
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

  const apiBase = resolveApiBase({ env, requestUrl: request.url });
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
  const rewriter = OGP_META_SELECTORS_TO_REMOVE.reduce(
    // eslint-disable-next-line max-params
    (rw, sel) => rw.on(sel, { element(el) { el.remove(); } }),
    new HTMLRewriter(),
  );
  return rewriter
    .on("head", {
      element(element) {
        element.append(metaHtml, { html: true });
      },
    })
    .transform(response);
};
