import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExploreIcon from "@mui/icons-material/Explore";
import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "./uiParts";

import type { ReactElement } from "react";
import { useState } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

import { usePublicCommunities } from "../api/communities.js";
import { SLACK_COLORS } from "../theme.js";

const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/**
 * サイドバーのコミュニティセクション。
 * コミュニティ一覧（全件）と「探す」リンクを表示する（ADR-0018 / ADR-0019）。
 * 見出し「コミュニティ」をクリックすると本体部（一覧・「探す」）を collapse で開閉できる（#483）。
 * 開閉状態は useState で管理し、初期状態は「展開」（永続化はスコープ外）。
 */
export const SidebarCommunitySection = (): ReactElement => {
  const { data: communities } = usePublicCommunities();
  const [expanded, setExpanded] = useState(true);

  return (
    <Box>
      <ListItemButton
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        sx={{ color: SLACK_COLORS.sidebarText, px: 1, py: 0.5 }}
      >
        <ListItemText
          primary="コミュニティ"
          primaryTypographyProps={{
            variant: "caption",
            sx: {
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            },
          }}
        />
        {expanded ? (
          <ExpandLess fontSize="small" />
        ) : (
          <ExpandMore fontSize="small" />
        )}
      </ListItemButton>
      <Collapse in={expanded} unmountOnExit>
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
      </Collapse>
    </Box>
  );
};
