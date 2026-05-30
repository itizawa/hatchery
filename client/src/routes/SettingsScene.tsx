import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

/** 設定画面のプレースホルダー（#25 で実装予定）。認証ガードが機能することの確認用。 */
export const SettingsScene = (): ReactElement => (
  <Box component="section" sx={{ p: 3 }}>
    <Typography variant="h5" component="h1" gutterBottom>
      設定
    </Typography>
    <Typography variant="body2" color="text.secondary">
      設定画面（#25 で実装予定）。
    </Typography>
  </Box>
);
