import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, List, ListItem, Stack, Typography, useMediaQuery } from "./uiParts";
import {
  createDisplayNameResolver,
  DEFAULT_EMPLOYEES,
  type Channel,
  type Employee,
  type MessageRecord,
} from "@hatchery/common";

import type { ReactElement } from "react";
import { useDripMessages } from "../hooks/useDripMessages.js";

const postedAtFormatter = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });

// API レスポンスは JSON.stringify 経由で Date → ISO 文字列になるため、string も受け付ける
const formatPostedAt = (date: Date | string): string =>
  postedAtFormatter.format(typeof date === "string" ? new Date(date) : date);

/** ヘッダ表示切り替えトランジションの所要時間（ms）。 */
export const HEADER_TRANSITION_MS = 200;

export interface ChannelViewProps {
  /** 表示対象のチャンネル（ヘッダのラベルに用いる）。 */
  channel: Channel;
  /** 当該チャンネルに属するメッセージ（Slack 風フラット一覧として表示）。 */
  messages: readonly MessageRecord[];
  /** createdEmployeeId → displayName 解決に用いる社員一覧。未指定なら common の DEFAULT_EMPLOYEES。 */
  employees?: readonly Employee[];
  /** 渡すとヘッダに編集ボタンを表示する。ログイン済みのときのみ渡すこと（#206）。 */
  onEditName?: () => void;
  /**
   * ヘッダの表示状態。false のとき非表示（フェードアウト）。
   * prefers-reduced-motion 環境では本 prop を無視して常時表示する。
   * 省略すると true（常時表示）。
   */
  headerVisible?: boolean;
}

/**
 * チャンネル詳細画面の presentational コンポーネント（#30）。
 * channel に属する message[] を「発言者名 + 本文」のフラットな一覧として描画する。
 * 新着メッセージはドリップ表示（タイピングインジケータ付き時間差）し、観戦感を演出する（#282）。
 * API・ルータ・グローバル状態には依存せず、props 駆動で Storybook の fixture 描画ができる
 * （client → common の一方向依存のみ）。createdEmployeeId は employees の displayName に解決し、
 * 未解決の ID はそのままフォールバック表示する（#222）。
 * ヘッダはスクロールコンテナ上部に sticky で固定し、headerVisible prop に応じてフェードイン/アウトする（#302）。
 */
export const ChannelView = ({
  channel,
  messages,
  employees = DEFAULT_EMPLOYEES,
  onEditName,
  headerVisible = true,
}: ChannelViewProps): ReactElement => {
  const resolveDisplayName = createDisplayNameResolver(employees);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { visibleMessages, typingEmployeeId } = useDripMessages(messages, prefersReducedMotion);

  // prefers-reduced-motion 時はヘッダを常時表示（アニメーション無効化）
  const effectiveVisible = prefersReducedMotion ? true : headerVisible;

  const isEmpty = visibleMessages.length === 0 && typingEmployeeId === null;

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Stack
        component="header"
        data-testid="channel-header"
        data-visible={effectiveVisible ? "true" : "false"}
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
          py: 1,
          mb: 1,
          opacity: effectiveVisible ? 1 : 0,
          transform: effectiveVisible ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: effectiveVisible ? "auto" : "none",
          transition: prefersReducedMotion
            ? "none"
            : `opacity ${HEADER_TRANSITION_MS}ms ease, transform ${HEADER_TRANSITION_MS}ms ease`,
        }}
      >
        <Typography variant="h5" component="h1">
          {channel.label}
        </Typography>
        {onEditName && (
          <IconButton aria-label="チャンネル名を編集" size="small" onClick={onEditName}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {isEmpty ? (
        <Typography variant="body2" color="text.secondary">
          このチャンネルにはまだメッセージがありません。
        </Typography>
      ) : (
        <List aria-label="メッセージ一覧" disablePadding>
          {visibleMessages.map((message) => (
            <ListItem key={message.id} alignItems="flex-start" disableGutters>
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
          {typingEmployeeId !== null && (
            <ListItem aria-label="入力中" alignItems="flex-start" disableGutters>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" component="span">
                  {resolveDisplayName(typingEmployeeId)}
                </Typography>
                <Typography variant="body2" component="span" sx={{ letterSpacing: 2 }}>
                  ●●●
                </Typography>
              </Stack>
            </ListItem>
          )}
        </List>
      )}
    </Box>
  );
};
