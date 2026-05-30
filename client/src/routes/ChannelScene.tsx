import { findChannelById, type Channel } from "@hatchery/common";
import { useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { ChannelView } from "../components/ChannelView";
import { getFixtureMessages } from "../fixtures/channelMessages";

/** channelId から既定チャンネルを解決する。未知 ID は `#${id}` ラベルでフォールバックする。 */
const resolveChannel = (channelId: string): Channel =>
  findChannelById(channelId) ?? { id: channelId, label: `#${channelId}` };

/**
 * チャンネル別ビュー（/channels/$channelId）のコンテナ（#30）。
 * channelId から Channel を解決し、当該チャンネルの message[] を presentational な
 * ChannelView に渡す薄いコンテナ。実データ取得（型共有パイプライン #8/#41・定時バッチ #32）が
 * 整うまでは fixture を注入する（後続の MVP 機能 Issue で実データへ差し替える）。
 */
export const ChannelScene = (): ReactElement => {
  const { channelId } = useParams({ strict: false });
  const id = channelId ?? "";
  const channel = resolveChannel(id);

  return <ChannelView channel={channel} messages={getFixtureMessages(id)} />;
};
