import {
  createDisplayNameResolver,
  DEFAULT_EMPLOYEES,
  type Channel,
  type Employee,
  type Message,
} from "@hatchery/common";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

export interface ChannelViewProps {
  /** 表示対象のチャンネル（ヘッダのラベルに用いる）。 */
  channel: Channel;
  /** 当該チャンネルに属するメッセージ（Slack 風フラット一覧として表示）。 */
  messages: readonly Message[];
  /** speaker(ID) → displayName 解決に用いる社員一覧。未指定なら common の DEFAULT_EMPLOYEES。 */
  employees?: readonly Employee[];
}

/**
 * チャンネル詳細画面の presentational コンポーネント（#30）。
 * channel に属する message[] を「発言者名 + 本文」のフラットな一覧として描画する。
 * API・ルータ・グローバル状態には依存せず、props 駆動で Storybook の fixture 描画ができる
 * （client → common の一方向依存のみ）。speaker(ID) は employees の displayName に解決し、
 * 未解決の ID はそのままフォールバック表示する。
 */
export const ChannelView = ({
  channel,
  messages,
  employees = DEFAULT_EMPLOYEES,
}: ChannelViewProps): ReactElement => {
  // speaker(ID) → displayName の解決（common の純粋関数。未解決は ID フォールバック）。
  const resolveDisplayName = createDisplayNameResolver(employees);

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {channel.label}
      </Typography>

      {messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          このチャンネルにはまだメッセージがありません。
        </Typography>
      ) : (
        <List aria-label="メッセージ一覧" disablePadding>
          {messages.map((message, index) => (
            <ListItem key={`${message.speaker}-${index}`} alignItems="flex-start" disableGutters>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" component="span">
                  {resolveDisplayName(message.speaker)}
                </Typography>
                <Typography variant="body2" component="span">
                  {message.text}
                </Typography>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
