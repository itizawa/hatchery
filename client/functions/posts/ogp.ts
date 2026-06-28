import type { OgpMeta } from "../shared/ogp";

export interface PostLike {
  id: string;
  title: string;
  text: string;
}

const POST_DESCRIPTION_MAX_LENGTH = 100;

export function buildPostOgpMeta(args: { post: PostLike; requestUrl: string }): OgpMeta {
  const { post, requestUrl } = args;
  const description =
    post.text.length > POST_DESCRIPTION_MAX_LENGTH
      ? post.text.slice(0, POST_DESCRIPTION_MAX_LENGTH) + "…"
      : post.text;
  return {
    title: `${post.title} - Hatchery`,
    description,
    url: requestUrl,
  };
}
