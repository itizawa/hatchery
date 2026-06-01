import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

/** アカウント設定画面（/account）。プロフィール編集等は #51 で追加する。 */
export const AccountScene = (): ReactElement => (
  <Box component="section" sx={{ p: 3 }}>
    <Typography variant="h5" component="h1" gutterBottom>
      アカウント設定
    </Typography>
  </Box>
);
