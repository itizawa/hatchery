import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRoundedIcon from "@mui/icons-material/NotificationsOffRounded";
import { IconButton, Tooltip } from "./uiParts";
import type { ReactElement } from "react";

interface NotifyToggleProps {
  notifyEnabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * community 単位の Web Push 通知 ON/OFF トグル（#1088）。
 * デバイス単位のグローバル ON/OFF（PushSubscribeButton）とは独立した設定。
 */
export const NotifyToggle = ({
  notifyEnabled,
  onToggle,
  disabled = false,
}: NotifyToggleProps): ReactElement => {
  const label = notifyEnabled ? "通知をオフにする" : "通知をオンにする";

  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          onClick={onToggle}
          disabled={disabled}
          size="small"
          sx={{ height: 32, width: 32 }}
        >
          {notifyEnabled ? (
            <NotificationsActiveRoundedIcon fontSize="small" color="primary" />
          ) : (
            <NotificationsOffRoundedIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
};
