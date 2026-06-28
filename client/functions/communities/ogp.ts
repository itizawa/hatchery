import type { OgpMeta } from "../shared/ogp";

export interface CommunityLike {
  id: string;
  slug: string;
  name: string;
  description: string;
}

const COMMUNITY_DESCRIPTION_MAX_LENGTH = 200;

export function buildCommunityOgpMeta(args: {
  community: CommunityLike;
  requestUrl: string;
}): OgpMeta {
  const { community, requestUrl } = args;
  const description =
    community.description.length > COMMUNITY_DESCRIPTION_MAX_LENGTH
      ? community.description.slice(0, COMMUNITY_DESCRIPTION_MAX_LENGTH) + "…"
      : community.description;
  return {
    title: `${community.name} - Hatchery`,
    description,
    url: requestUrl,
  };
}
