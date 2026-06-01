import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useState, type FormEvent, type ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { useCreateChannel } from "../api/channels.js";

/**
 * チャンネル追加フォーム（#47）。ログイン時のみ表示する（未ログインでは何も描画しない）。
 * 送信で POST /channels を呼び、成功後は入力欄をクリアする（一覧は useCreateChannel が invalidate）。
 */
export const AddChannelForm = (): ReactElement | null => {
  const { data: user } = useAuth();
  const createChannel = useCreateChannel();
  const [label, setLabel] = useState("");

  if (!user) return null;

  const trimmed = label.trim();
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmed) return;
    createChannel.mutate(trimmed, { onSuccess: () => setLabel("") });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-label="チャンネル追加"
      sx={{ display: "flex", gap: 1, mt: 1 }}
    >
      <TextField
        size="small"
        label="チャンネル名"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        inputProps={{ "aria-label": "チャンネル名" }}
      />
      <Button type="submit" variant="contained" disabled={!trimmed || createChannel.isPending}>
        追加
      </Button>
    </Box>
  );
};
