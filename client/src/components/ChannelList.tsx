import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Box, IconButton, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem } from "./uiParts";

import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent, type ReactElement } from "react";

import type { Channel, ChannelType } from "@hatchery/common";
import { useAuth } from "../api/auth.js";
import { useChannels } from "../api/channels.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { SLACK_COLORS } from "../theme.js";
import { EditChannelNameDialog } from "./EditChannelNameDialog.js";

const CHANNEL_TYPE_SYMBOLS: Record<ChannelType, string> = {
  zatsudan: "#",
  task: "✓",
  planning: "💡",
};

function ChannelTypeIcon({ type }: { type: ChannelType }): ReactElement {
  return (
    <Box
      component="span"
      data-testid={`channel-type-icon-${type}`}
      aria-hidden="true"
      sx={{ fontSize: "0.85rem", fontWeight: "bold", mr: 0.5, userSelect: "none" }}
    >
      {CHANNEL_TYPE_SYMBOLS[type]}
    </Box>
  );
}

/**
 * サイドバーのチャンネル一覧。GET /channels（TanStack Query）を単一情報源として描画する（#47・#54）。
 * DEFAULT_CHANNELS のハードコード参照は廃止し、DB から取得した一覧を表示する。
 * タイプ（zatsudan / task）に応じてアイコンを表示する（#54）。
 * 各チャンネル項目は /channels/$channelId へのリンクになっている（#182）。
 * ログイン済みのときは hover 時に 3 点メニューを表示し、チャンネル名編集ができる（#206）。
 */
export const ChannelList = (): ReactElement => {
  const { data: user } = useAuth();
  const { data: channels } = useChannels();
  const isMobile = useIsMobile();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuChannel, setMenuChannel] = useState<Channel | null>(null);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);

  useEffect(() => {
    setMenuAnchor(null);
    setMenuChannel(null);
  }, [isMobile]);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>, channel: Channel): void => {
    event.preventDefault();
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuChannel(channel);
  };

  const handleMenuClose = (): void => {
    setMenuAnchor(null);
    setMenuChannel(null);
  };

  const handleEditOpen = (): void => {
    setEditChannel(menuChannel);
    handleMenuClose();
  };

  const handleEditClose = (): void => {
    setEditChannel(null);
  };

  return (
    <>
      <List dense aria-label="チャンネル一覧">
        {channels.map((channel) => (
          <ListItem
            key={channel.id}
            disablePadding
            secondaryAction={
              user && !isMobile ? (
                <IconButton
                  aria-label={`${channel.label}のメニューを開く`}
                  size="small"
                  onClick={(e) => handleMenuOpen(e, channel)}
                  sx={{
                    opacity: 0,
                    transition: "opacity 0.1s",
                    ".MuiListItem-root:hover &": { opacity: 1 },
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              ) : undefined
            }
          >
            <ListItemButton
              component={RouterLink}
              to={`/channels/${channel.id}`}
              sx={{ color: SLACK_COLORS.sidebarText, textDecoration: "none" }}
            >
              <ChannelTypeIcon type={channel.type} />
              <ListItemText primary={channel.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEditOpen}>名前を編集</MenuItem>
      </Menu>
      {editChannel && (
        <EditChannelNameDialog
          open={true}
          channel={editChannel}
          onClose={handleEditClose}
        />
      )}
    </>
  );
};
