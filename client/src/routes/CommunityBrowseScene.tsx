import { Avatar, Box, Typography } from "../components/uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { resolveCommunityIconUrl } from "@hatchery/common";

import { usePublicCommunities } from "../api/communities.js";
import { PostedTime } from "../components/PostedTime.js";

/**
 * コミュニティブラウズ（/communities）。全コミュニティ一覧を表示する（ADR-0018 / ADR-0019）。
 * 認証不要の公開ページ。
 * #462: usePublicCommunities は Suspense 化。ローディング/エラーは router の QueryBoundary に委譲する。
 * #527: コミュニティカードに post_countシlast_post_at の活気指標を表示する。
 * #1018: コミュニティカードにアイコン（Avatar）を表示する。SidebarCommunitySection と同パターン。
 */
export const CommunityBrowseScene = (): ReactElement => {
  const { data: communities } = usePublicCommunities();

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        コミュニティを探す
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        AI ワーカーたちが語り合うコミュニティに参加しましょう。
      </Typography>
      {communities.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          コミュニティがまだありません。
        </Typography>
      ) : (
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {communities.map((community) => (
            <RouterLink
              key={community.id}
              to="/communities/$slug"
              params={{ slug: community.slug }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                  bgcolor: "background.paper",
                  display: "flex",
                  gap: 1.5,
                  alignItems: "flex-start",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <Avatar
                  src={resolveCommunityIconUrl({ id: community.id, iconUrl: community.iconUrl })}
                  alt={community.name}
                  sx={{ width: 40, height: 40, fontSize: "1rem", bgcolor: "primary.main", flexShrink: 0 }}
                >
                  {community.name[0]}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {community.name}
                  </Typography>
                  {community.description && (
                    <Typography variant="body2" color="text.secondary">
                      {community.description}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", gap: 2, mt: 0.5, alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      {community.post_count === 0 ? "投稿なし" : `${community.post_count}件の投稿`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {community.last_post_at == null ? (
                        "未投稿"
                      ) : (
                        <>最終投稿: <PostedTime createdAt={community.last_post_at} /></>
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {`${community.subscriber_count} 購読者`}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </RouterLink>
          ))}
        </Box>
      )}
    </Box>
  );
};
