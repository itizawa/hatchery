import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, List, ListItem, Stack, Typography } from "./uiParts";
import {
  createDisplayNameResolver,
  DEFAULT_EMPLOYEES,
  type Channel,
  type Employee,
  type MessageRecord,
} from "@hatchery/common";

import type { ReactElement } from "react";

const formatPostedAt = (date: Date): string =>
  new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);

export interface ChannelViewProps {
  /** 表示対象のチャンネル（ヘッダのラベルに用いる）。 */
  channel: Channel;
  /** 当該チャンネルに属するメッセージ（Slack 風フラット一覧として表示）。 */
  messages: readonly MessageRecord[];
  /** createdEmployeeId → displayName 解決に用いる社員一覧。未指定なら common の DEFAULT_EMPLOYEES。 */
  employees?: readonly Employee[];
  /** 渡すとヘッダに編集ボタンを表示する。ログイン済みのときのみ渡すこと（#206）。 */
  onEditName?: () => void;
}

/**
 * チャンネル詳細画面の presentational コンポーネント（#30）。
 * channel に属する message[] を「発言者名 + 本文」のフラットな一覧として描画する。
 * API・ルータ・グローバル状態には依存せず、props 駆動で Storybook の fixture 描画ができる
 * （client → common の一方向依存のみ）。createdEmployeeId は employees の displayName に解決し、
 * 未解決の ID はそのままフォールバック表示する（#222）。
 */
export const ChannelView = ({
  channel,
  messages,
  employees = DEFAULT_EMPLOYEES,
  onEditName,
}: ChannelViewProps): ReactElement => {
  const resolveDisplayName = createDisplayNameResolver(employees);

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="h5" component="h1">
          {channel.label}
        </Typography>
        {onEditName && (
          <IconButton aria-label="チャンネル名を編集" size="small" onClick={onEditName}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          このチャンネルにはまだメッセージがありません。
        </Typography>
      ) : (
        <List aria-label="メッセージ一覧" disablePadding>
          {messages.map((message, index) => (
            <ListItem key={`${message.createdEmployeeId}-${index}`} alignItems="flex-start" disableGutters>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="subtitle2" component="span">
                    {resolveDisplayName(message.createdEmployeeId)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {formatPostedAt(message.postedAt)}
                  </Typography>
                </Stack>
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
