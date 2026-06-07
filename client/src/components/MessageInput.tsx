import { Box, Button, TextField } from "./uiParts";

import { useState, type FormEvent, type ReactElement } from "react";

import { MAX_MESSAGE_LENGTH } from "@hatchery/common";

export interface MessageInputProps {
  /** 送信時に呼ばれるコールバック（text は空でないことが保証される）。 */
  onSubmit: (text: string) => void;
  /** true のとき入力欄・送信ボタンを両方 disabled にする（送信中などに使う）。 */
  disabled: boolean;
}

/** チャンネルへのメッセージ投稿フォーム（#48）。text が空のとき送信ボタンは disabled。 */
export const MessageInput = ({ onSubmit, disabled }: MessageInputProps): ReactElement => {
  const [text, setText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: "flex",
        gap: 1,
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        flexShrink: 0,
        bgcolor: "background.default",
      }}
    >
      <TextField
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="メッセージを入力..."
        size="small"
        disabled={disabled}
        fullWidth
        inputProps={{ "aria-label": "メッセージ入力", maxLength: MAX_MESSAGE_LENGTH }}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={disabled || !text.trim()}
        aria-label="送信"
      >
        送信
      </Button>
    </Box>
  );
};
