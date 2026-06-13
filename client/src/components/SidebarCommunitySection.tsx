import ExploreIcon from "@mui/icons-material/Explore";
import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from "./uiParts";

import type { ReactElement } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

import { usePublicCommunities } from "../api/communities.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/**
 * コミュニティ一覧のリスト項目（Suspense フックを使う部分）。
 * #462: usePublicCommunities は Suspense 化。読み込み中/失敗時はサイドバーを縮退させたいので、
 * このコンポーネントを SidebarCommunitySection 内の局所 QueryBoundary（fallback/errorFallback=何も表示しない）で包む。
 */
const SidebarCommunityItems = (): ReactElement => {
  const { data: communities } = usePublicCommunities();

  return (
    <>
      {communities.map((community) => (
        <ListItem key={community.id} disablePadding>
          <ListItemButton
            component={RouterLink}
            to={`/communities/${community.slug}` as "/communities/$slug"}
            sx={{ color: SLACK_COLORS.sidebarText, py: 0.25 }}
          >
            <ListItemText
              primary={community.name}
              primaryTypographyProps={{ variant: "body2" }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </>
  );
};

/**
 * サイドバーのコミュニティセクション。
 * コミュニティ一覧（全件）と「探す」リンクを表示する（ADR-0018 / ADR-0019）。
 * #462: 一覧取得（usePublicCommunities）は Suspense 化し、レイアウト全体が suspend しないよう
 * 局所 QueryBoundary で包む。読み込み中・取得失敗時はコミュニティ行を出さず「探す」リンクは常に表示する。
 */
export const SidebarCommunitySection = (): ReactElement => {
  return (
    <Box>
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            color: SLACK_COLORS.sidebarText,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          コミュニティ
        </Typography>
      </Box>
      <List dense>
        <QueryBoundary fallback={null} errorFallback={() => null}>
          <SidebarCommunityItems />
        </QueryBoundary>
        <ListItem disablePadding>
          <ListItemButton
            component={RouterLink}
            to="/communities"
            sx={{ color: SLACK_COLORS.sidebarText, py: 0.25 }}
          >
            <Box component="span" sx={SIDEBAR_ICON_SX}>
              <ExploreIcon fontSize="small" />
            </Box>
            <ListItemText
              primary="探す"
              primaryTypographyProps={{ variant: "body2" }}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};
