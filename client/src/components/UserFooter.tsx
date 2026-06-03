import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useAuth, useLogout } from "../api/auth.js";
import { SLACK_COLORS } from "../theme.js";

export const UserFooter = (): ReactElement | null => {
  const { data: user, isLoading } = useAuth();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();

  if (isLoading || !user) return null;

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => navigate({ to: "/login" }),
    });
  };

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        mt: "auto",
        pt: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderTop: `1px solid rgba(255,255,255,0.15)`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: SLACK_COLORS.blue, fontSize: 14 }}>
          {initial}
        </Avatar>
        <Typography
          variant="body2"
          sx={{ color: SLACK_COLORS.sidebarText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {user.displayName}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Link
          component={RouterLink}
          to="/account"
          sx={{ color: SLACK_COLORS.sidebarText }}
          underline="hover"
        >
          アカウント設定
        </Link>
        <Button
          size="small"
          aria-label="ログアウト"
          onClick={handleLogout}
          sx={{ color: SLACK_COLORS.sidebarText, textTransform: "none", p: 0, minWidth: 0 }}
        >
          ログアウト
        </Button>
      </Box>
    </Box>
  );
};
