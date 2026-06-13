import { Box, Typography } from "../components/uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { usePublicCommunities } from "../api/communities.js";

/**
 * コミュニティブラウズ（/communities）。全コミュニティ一覧を表示する（ADR-0018 / ADR-0019）。
 * 認証不要の公開ページ。
 * #462: usePublicCommunities は Suspense 化。ローディング/エラーは router の QueryBoundary に委譲する。
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
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {community.name}
                </Typography>
                {community.description && (
                  <Typography variant="body2" color="text.secondary">
                    {community.description}
                  </Typography>
                )}
              </Box>
            </RouterLink>
          ))}
        </Box>
      )}
    </Box>
  );
};
