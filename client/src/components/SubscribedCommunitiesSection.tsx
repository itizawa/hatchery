import ExpandLess from "@mui/icons-material/ExpandLessRounded";
import ExpandMore from "@mui/icons-material/ExpandMoreRounded";
import {
  Avatar,
  Badge,
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "./uiParts";

import type { ReactElement } from "react";
import { useState } from "react";
import { Link as RouterLink } from "@tanstack/react-router";

import { useAuth } from "../api/auth.js";
import { usePublicCommunities } from "../api/communities.js";
import { useUnreadCounts } from "../api/subscriptions.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { SLACK_COLORS } from "../theme.js";
import { SIDEBAR_ICON_SIZE } from "./SidebarCommunitySection.js";

const SIDEBAR_ICON_SX = { color: SLACK_COLORS.sidebarText, minWidth: 36 } as const;

/** バッジの数値表示（99 超は "99+" で上限表示）。 */
function badgeContent(count: number): string | number {
  return count > 99 ? "99+" : count;
}

/**
 * 購読コミュニティセクション本体（Suspense フックを使う部分）。
 * SubscribedCommunitiesInner による認証ガード後にのみレンダーされるため、
 * useSuspenseQuery は認証済みユーザーのみで呼ばれることが保証される。
 * unread_counts が空（購読なし）のときは null を返してヘッダーも非表示にする（#934）。
 */
const SubscribedCommunitiesBody = (): ReactElement | null => {
  const [expanded, setExpanded] = useState(true);
  const { data: unreadData } = useUnreadCounts();
  const { data: communities } = usePublicCommunities();
  const { unread_counts } = unreadData;

  if (unread_counts.length === 0) return null;

  return (
    <Box>
      <ListItemButton
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        sx={{ color: SLACK_COLORS.sidebarText, px: 1, py: 0.5 }}
      >
        <ListItemText
          primary="購読中"
          slotProps={{
            primary: {
              variant: "caption",
              sx: {
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              },
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
          {unread_counts.map((item) => {
            const community = communities.find((c) => c.id === item.community_id);
            const displayName = community?.name ?? item.community_slug;
            const iconUrl = community?.iconUrl ?? undefined;
            const hasUnread = item.unread_count > 0;

            return (
              <ListItem key={item.community_id} disablePadding>
                <ListItemButton
                  component={RouterLink}
                  to={`/communities/${item.community_slug}` as "/communities/$slug"}
                  sx={{ color: SLACK_COLORS.sidebarText, py: 0.25 }}
                >
                  <ListItemIcon sx={SIDEBAR_ICON_SX}>
                    <Badge
                      badgeContent={hasUnread ? badgeContent(item.unread_count) : null}
                      color="primary"
                      sx={{
                        "& .MuiBadge-badge": {
                          fontSize: "0.6rem",
                          minWidth: 16,
                          height: 16,
                          padding: "0 4px",
                        },
                      }}
                      data-testid={hasUnread ? `unread-badge-${item.community_id}` : undefined}
                    >
                      <Avatar
                        src={iconUrl}
                        alt={displayName}
                        sx={{
                          width: SIDEBAR_ICON_SIZE,
                          height: SIDEBAR_ICON_SIZE,
                          fontSize: "0.75rem",
                          bgcolor: "primary.main",
                        }}
                      >
                        {displayName[0]}
                      </Avatar>
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={displayName}
                    slotProps={{ primary: { variant: "body2" } }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Collapse>
    </Box>
  );
};

/**
 * サイドバー「購読中」セクション本体（ログイン済みのみ）。
 * useAuth で認証状態を確認し、未ログインは null を返す。
 * ログイン済みの場合のみ SubscribedCommunitiesBody をレンダーし、
 * そこで unread_counts が空かどうかを判定する。
 */
const SubscribedCommunitiesInner = (): ReactElement | null => {
  const { data: user } = useAuth();

  if (!user) return null;

  return <SubscribedCommunitiesBody />;
};

/**
 * サイドバーの「購読中」セクション（#934）。
 * ログイン済みかつ購読コミュニティが 1 件以上ある場合のみ表示する。
 * 各コミュニティに未読数バッジを表示し、99 超は "99+" で上限表示する。
 * QueryBoundary でラップして Suspense に対応する。
 */
export const SubscribedCommunitiesSection = (): ReactElement => (
  <QueryBoundary fallback={null} errorFallback={() => null}>
    <SubscribedCommunitiesInner />
  </QueryBoundary>
);
