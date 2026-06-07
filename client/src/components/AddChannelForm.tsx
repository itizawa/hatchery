import { Box, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from "./uiParts";

import { useState, type FormEvent, type ReactElement } from "react";

import { CHANNEL_LABEL_MAX_LENGTH, type ChannelType } from "@hatchery/common";
import { useAuth } from "../api/auth.js";
import { useCreateChannel } from "../api/channels.js";

/**
 * チャンネル追加フォーム（#47・#54）。ログイン時のみ表示する（未ログインでは何も描画しない）。
 * 送信で POST /channels を呼び、成功後は入力欄をクリアする（一覧は useCreateChannel が invalidate）。
 * タイプ（zatsudan / task）を選択できる（#54）。
 */
export const AddChannelForm = (): ReactElement | null => {
  const { data: user } = useAuth();
  const createChannel = useCreateChannel();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ChannelType>("zatsudan");

  if (!user) return null;

  const trimmed = label.trim();
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmed) return;
    createChannel.mutate({ label: trimmed, type }, { onSuccess: () => setLabel("") });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      aria-label="チャンネル追加"
      sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}
    >
      <TextField
        size="small"
        label="チャンネル名"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        inputProps={{ "aria-label": "チャンネル名", maxLength: CHANNEL_LABEL_MAX_LENGTH }}
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
      <Button type="submit" variant="contained" disabled={!trimmed || createChannel.isPending}>
        追加
      </Button>
    </Box>
  );
};
