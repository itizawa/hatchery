import { findChannelById, type Channel } from "@hatchery/common";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { useChannelMessages, useChannels, usePostChannelMessage } from "../api/channels.js";
import { Box } from "../components/uiParts";
import { ChannelView } from "../components/ChannelView.js";
import { MessageInput } from "../components/MessageInput.js";

/**
 * channelId から Channel を解決する。API のチャンネル一覧（GET /channels）を単一情報源とし
 * （ADR-0006・サイドバーと同源）、見つからなければ common の既定チャンネル、
 * それも無ければ `#${id}` ラベルでフォールバックする。
 */
const resolveChannel = (channels: readonly Channel[], channelId: string): Channel =>
  channels.find((c) => c.id === channelId) ??
  findChannelById(channelId) ?? { id: channelId, label: `#${channelId}`, type: "zatsudan" };

/**
 * チャンネル別ビュー（/channels/$channelId）のコンテナ（#30）。
 * channelId から Channel を解決し、実 API でメッセージを取得して presentational な
 * ChannelView に渡す（#48）。ログイン済みユーザーはメッセージ投稿フォームも表示する。
 */
export const ChannelScene = (): ReactElement => {
  const { channelId } = useParams({ strict: false });
  const id = channelId ?? "";
  const { data: channels } = useChannels();
  const channel = resolveChannel(channels, id);

  const { data: messages } = useChannelMessages(id);
  const { data: authUser } = useAuth();
  const { mutate: postMessage, isPending } = usePostChannelMessage(id);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <ChannelView channel={channel} messages={messages} />
      </Box>
      {authUser && <MessageInput onSubmit={postMessage} disabled={isPending} />}
    </Box>
  );
};
