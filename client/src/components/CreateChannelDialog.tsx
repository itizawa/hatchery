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
  Typography,
} from "./uiParts";

import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";

import { CHANNEL_LABEL_MAX_LENGTH, type ChannelGoalType } from "@hatchery/common";
import { useCreateChannel } from "../api/channels.js";

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateChannelDialog = ({ open, onClose }: CreateChannelDialogProps): ReactElement => {
  const createChannel = useCreateChannel();

  const form = useForm({
    defaultValues: {
      label: "",
      goalType: "chat" as ChannelGoalType,
    },
    onSubmit: ({ value }) => {
      createChannel.mutate(
        { label: value.label.trim(), goal: { type: value.goalType } },
        {
          onSuccess: () => {
            form.reset();
            onClose();
          },
        },
      );
    },
  });

  const handleClose = (): void => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>チャンネルを追加</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <form.Field
            name="label"
            validators={{
              onSubmit: ({ value }) => (!value.trim() ? "チャンネル名は必須です" : undefined),
            }}
          >
            {(field) => (
              <TextField
                size="small"
                label="チャンネル名"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                inputProps={{ "aria-label": "チャンネル名", maxLength: CHANNEL_LABEL_MAX_LENGTH }}
                error={field.state.meta.errors.length > 0}
                helperText={field.state.meta.errors[0] ?? ""}
                autoFocus
                fullWidth
              />
            )}
          </form.Field>
          <form.Field name="goalType">
            {(field) => (
              <FormControl>
                <FormLabel>AI の振る舞い</FormLabel>
                <RadioGroup
                  row
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as ChannelGoalType)}
                  aria-label="AI の振る舞い"
                >
                  <FormControlLabel value="chat" control={<Radio />} label="発言（会話）" />
                  <FormControlLabel value="issue" control={<Radio />} label="起票（Issue 作成）" />
                </RadioGroup>
              </FormControl>
            )}
          </form.Field>
          {createChannel.isError && (
            <Typography variant="caption" color="error">
              作成に失敗しました。もう一度お試しください。
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>キャンセル</Button>
          <form.Subscribe selector={(state) => state.values.label}>
            {(label) => (
              <Button
                type="submit"
                variant="contained"
                disabled={!label.trim() || createChannel.isPending}
              >
                追加
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
