import ExploreIcon from "@mui/icons-material/Explore";
import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from "./uiParts";

import type { ReactElement } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

import { usePublicCommunities } from "../api/communities.js";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/**
 * サイドバーのコミュニティセクション。
 * コミュニティ一覧（全件）と「探す」リンクを表示する（ADR-0018 / ADR-0019）。
 */
export const SidebarCommunitySection = (): ReactElement => {
  const { data: communities } = usePublicCommunities();

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
        {communities && communities.map((community) => (
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
