import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

/**
 * ホームルート（/）。定時に生成されたメッセージタイムラインを表示する枠。
 * 実データ表示（API 連携）は型共有パイプライン(#8)・MVP 機能 Issue で実装する。
 */
export const HomeScene = (): ReactElement => (
  <Box component="section" sx={{ p: 3 }}>
    <Typography variant="h5" component="h1" gutterBottom>
      タイムライン
    </Typography>
    <Typography variant="body2" color="text.secondary">
      定時に生成された社員たちのメッセージがここに表示されます（現在は枠のみ）。
    </Typography>
  </Box>
);
