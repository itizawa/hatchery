import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import type { ReactElement } from "react";

import type { ChannelType } from "@hatchery/common";
import { useChannels } from "../api/channels.js";
import { SLACK_COLORS } from "../theme.js";

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
 */
export const ChannelList = (): ReactElement => {
  const { data: channels = [] } = useChannels();

  return (
    <List dense aria-label="チャンネル一覧">
      {channels.map((channel) => (
        <ListItem key={channel.id} disablePadding>
          <ListItemButton sx={{ color: SLACK_COLORS.sidebarText }}>
            <ChannelTypeIcon type={channel.type} />
            <ListItemText primary={channel.label} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
