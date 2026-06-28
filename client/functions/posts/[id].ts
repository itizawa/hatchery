import { buildOgpMetaHtml, isCrawler, resolveApiBase, type PagesContext } from "../shared/ogp";
import { buildPostOgpMeta, type PostLike } from "./ogp";

interface PostApiResponse {
  post: {
    id: string;
    title: string;
    text: string;
  };
}

async function fetchPost(args: { apiBase: string; postId: string }): Promise<PostLike | null> {
  try {
    const res = await fetch(`${args.apiBase}/api/posts/${args.postId}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { post } = data as PostApiResponse;
    if (
      typeof post !== "object" ||
      post === null ||
      typeof post.id !== "string" ||
      typeof post.title !== "string" ||
      typeof post.text !== "string"
    ) {
      return null;
    }
    return { id: post.id, title: post.title, text: post.text };
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

  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!postId) {
    return next();
  }

  const apiBase = resolveApiBase({ env, requestUrl: request.url });
  const post = await fetchPost({ apiBase, postId });
  if (!post) {
    return next();
  }

  const meta = buildPostOgpMeta({ post, requestUrl: request.url });
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
