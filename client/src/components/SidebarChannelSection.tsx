import AddIcon from "@mui/icons-material/Add";
import { Box, IconButton, Tooltip, Typography } from "./uiParts";

import { Suspense, useState, type ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { SLACK_COLORS } from "../theme.js";
import { ChannelList } from "./ChannelList";
import { ChannelListSkeleton } from "./ChannelListSkeleton";
import { CreateChannelDialog } from "./CreateChannelDialog";

export const SidebarChannelSection = (): ReactElement => {
  const { data: user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: SLACK_COLORS.sidebarText,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          チャンネル
        </Typography>
        {user && (
          <Tooltip title="チャンネルを追加">
            <IconButton
              aria-label="チャンネルを追加"
              size="small"
              onClick={() => setDialogOpen(true)}
              sx={{ color: SLACK_COLORS.sidebarText, p: 0.25 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Suspense fallback={<ChannelListSkeleton />}>
        <ChannelList />
      </Suspense>
      <CreateChannelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
};
