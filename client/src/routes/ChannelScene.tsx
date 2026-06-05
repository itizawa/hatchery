import { findChannelById, type Channel } from "@hatchery/common";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useAuth } from "../api/auth.js";
import { useChannelMessages, usePostChannelMessage } from "../api/channels.js";
import { ChannelView } from "../components/ChannelView.js";
import { MessageInput } from "../components/MessageInput.js";

/** channelId から既定チャンネルを解決する。未知 ID は `#${id}` ラベルでフォールバックする。 */
const resolveChannel = (channelId: string): Channel =>
  findChannelById(channelId) ?? { id: channelId, label: `#${channelId}`, type: "zatsudan" };

/**
 * チャンネル別ビュー（/channels/$channelId）のコンテナ（#30）。
 * channelId から Channel を解決し、実 API でメッセージを取得して presentational な
 * ChannelView に渡す（#48）。ログイン済みユーザーはメッセージ投稿フォームも表示する。
 */
export const ChannelScene = (): ReactElement => {
  const { channelId } = useParams({ strict: false });
  const id = channelId ?? "";
  const channel = resolveChannel(id);

  const { data: messages } = useChannelMessages(id);
  const { data: authUser } = useAuth();
  const { mutate: postMessage, isPending } = usePostChannelMessage(id);

  return (
    <>
      <ChannelView channel={channel} messages={messages} />
      {authUser && <MessageInput onSubmit={postMessage} disabled={isPending} />}
    </>
  );
};
