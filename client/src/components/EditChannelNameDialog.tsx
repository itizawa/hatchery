import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "./uiParts";
import { useEffect, useState, type FormEvent, type ReactElement } from "react";

import { CHANNEL_LABEL_MAX_LENGTH, type Channel } from "@hatchery/common";
import { useUpdateChannel } from "../api/channels.js";

interface Props {
  open: boolean;
  channel: Channel;
  onClose: () => void;
}

export const EditChannelNameDialog = ({ open, channel, onClose }: Props): ReactElement => {
  const [label, setLabel] = useState(channel.label);
  const updateChannel = useUpdateChannel();

  useEffect(() => {
    if (open) setLabel(channel.label);
  }, [open]); // channel.label の背景更新でユーザー入力がリセットされないよう open の変化のみに反応する

  const handleClose = (): void => {
    onClose();
  };

  const trimmed = label.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmed) return;
    updateChannel.mutate({ id: channel.id, label: trimmed }, { onSuccess: handleClose });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>チャンネル名を編集</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            autoFocus
            size="small"
            label="チャンネル名"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            inputProps={{ "aria-label": "チャンネル名", maxLength: CHANNEL_LABEL_MAX_LENGTH }}
            fullWidth
          />
          {updateChannel.isError && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              保存に失敗しました。もう一度お試しください。
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>キャンセル</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!trimmed || updateChannel.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
