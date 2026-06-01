import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import type { ReactElement } from "react";

import { useChannels } from "../api/channels.js";

/**
 * サイドバーのチャンネル一覧。GET /channels（TanStack Query）を単一情報源として描画する（#47）。
 * DEFAULT_CHANNELS のハードコード参照は廃止し、DB から取得した一覧を表示する。
 * クリック時の遷移は MVP 機能 Issue で実装する。
 */
export const ChannelList = (): ReactElement => {
  const { data: channels = [] } = useChannels();

  return (
    <List dense aria-label="チャンネル一覧">
      {channels.map((channel) => (
        <ListItem key={channel.id} disablePadding>
          <ListItemButton>
            <ListItemText primary={channel.label} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
