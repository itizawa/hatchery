import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

/**
 * チャンネル別ビュー（/channels/$channelId）の枠。選択中チャンネル ID を表示する。
 * 当該チャンネルのシーン一覧表示（API 連携）は型共有パイプライン(#8)・MVP 機能 Issue で実装する。
 */
export const ChannelScene = (): ReactElement => {
  const { channelId } = useParams({ strict: false });

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        チャンネル: {channelId}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        このチャンネルのシーン一覧がここに表示されます（現在は枠のみ）。
      </Typography>
    </Box>
  );
};
