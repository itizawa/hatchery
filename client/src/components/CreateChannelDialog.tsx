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
  Radio,
  RadioGroup,
  TextField,
} from "./uiParts";

import { useState, type FormEvent, type ReactElement } from "react";

import { CHANNEL_LABEL_MAX_LENGTH, type ChannelType } from "@hatchery/common";
import { useCreateChannel } from "../api/channels.js";

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateChannelDialog = ({ open, onClose }: CreateChannelDialogProps): ReactElement => {
  const createChannel = useCreateChannel();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ChannelType>("zatsudan");

  const trimmed = label.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmed) return;
    createChannel.mutate(
      { label: trimmed, type },
      {
        onSuccess: () => {
          setLabel("");
          setType("zatsudan");
          onClose();
        },
      },
    );
  };

  const handleClose = (): void => {
    setLabel("");
    setType("zatsudan");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>チャンネルを追加</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            size="small"
            label="チャンネル名"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            inputProps={{ "aria-label": "チャンネル名", maxLength: CHANNEL_LABEL_MAX_LENGTH }}
            autoFocus
            fullWidth
          />
          <FormControl>
            <FormLabel>タイプ</FormLabel>
            <RadioGroup
              row
              value={type}
              onChange={(e) => setType(e.target.value as ChannelType)}
            >
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
  );
};
