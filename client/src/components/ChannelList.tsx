import { DEFAULT_CHANNELS } from "@hatchery/common";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import type { ReactElement } from "react";

/**
 * サイドバーのチャンネル一覧。common の DEFAULT_CHANNELS を単一情報源として描画する
 * （client → common の実依存）。クリック時の遷移は MVP 機能 Issue で実装する。
 */
export const ChannelList = (): ReactElement => (
  <List dense aria-label="チャンネル一覧">
    {DEFAULT_CHANNELS.map((channel) => (
      <ListItem key={channel.id} disablePadding>
        <ListItemButton>
          <ListItemText primary={channel.label} />
        </ListItemButton>
      </ListItem>
    ))}
  </List>
);
