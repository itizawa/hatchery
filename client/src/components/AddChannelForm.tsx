import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Tooltip,
} from "./uiParts";

import { useState, type FormEvent, type ReactElement } from "react";

import { CHANNEL_LABEL_MAX_LENGTH, type ChannelType } from "@hatchery/common";
import { useAuth } from "../api/auth.js";
import { useCreateChannel } from "../api/channels.js";

export const AddChannelForm = (): ReactElement | null => {
  const { data: user } = useAuth();
  const createChannel = useCreateChannel();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ChannelType>("zatsudan");

  if (!user) return null;

  const handleOpen = (): void => setOpen(true);
  const handleClose = (): void => {
    setOpen(false);
    setLabel("");
    setType("zatsudan");
  };

  const trimmed = label.trim();
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmed) return;
    createChannel.mutate(
      { label: trimmed, type },
      {
        onSuccess: () => {
          setLabel("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <>
      <Tooltip title="チャンネル作成">
        <IconButton aria-label="チャンネル作成" onClick={handleOpen} size="small" sx={{ mt: 1 }}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>チャンネル作成</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              autoFocus
              size="small"
              label="チャンネル名"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              inputProps={{ "aria-label": "チャンネル名", maxLength: CHANNEL_LABEL_MAX_LENGTH }}
              fullWidth
            />
            <FormControl>
              <FormLabel>タイプ</FormLabel>
              <RadioGroup row value={type} onChange={(e) => setType(e.target.value as ChannelType)}>
                <FormControlLabel value="zatsudan" control={<Radio />} label="雑談" />
                <FormControlLabel value="task" control={<Radio />} label="仕事" />
              </RadioGroup>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>キャンセル</Button>
            <Button type="submit" variant="contained" disabled={!trimmed || createChannel.isPending}>
              追加
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};
