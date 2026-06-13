import { googleLoginUrl } from "../api/auth";
import { Box, Button, Typography } from "../components/uiParts";

import type { ReactElement } from "react";

/** ログイン画面（#455: Google 認証のみに統一）。 */
export const LoginScene = (): ReactElement => {
  return (
    <Box
      sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 4, display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        ログイン
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Google アカウントでログインしてください。
      </Typography>
      <Button
        variant="contained"
        fullWidth
        onClick={() => {
          window.location.href = googleLoginUrl();
        }}
      >
        Google でログイン
      </Button>
    </Box>
  );
};
