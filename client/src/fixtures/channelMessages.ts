import { type Message } from "@hatchery/common";

/**
 * チャンネル詳細画面（#30）の動作確認用 fixture（プレースホルダ）。
 * 実 API（型共有パイプライン #8/#41 / 定時バッチ #32）が整うまでの暫定データで、
 * Story と ChannelScene コンテナが共有する（単一情報源・DRY）。
 * チャンネル ID をキーに、そのチャンネルに属する message[] を返す。
 */
export const FIXTURE_MESSAGES_BY_CHANNEL: Readonly<Record<string, readonly Message[]>> = {
  zatsudan: [
    {
      speaker: "haru",
      channel: "zatsudan",
      text: "おはようございます！今日もはりきっていきましょう。",
    },
    { speaker: "ken", channel: "zatsudan", text: "おはよう。コーヒー淹れてきたよ。" },
    { speaker: "mei", channel: "zatsudan", text: "おはようございます！よろしくお願いします。" },
    { speaker: "haru", channel: "zatsudan", text: "そういえば昨日のランチ美味しかったね。" },
  ],
  shigoto: [
    { speaker: "ken", channel: "shigoto", text: "今日のタスク、まず仕様の確認から始めよう。" },
    {
      speaker: "mei",
      channel: "shigoto",
      text: "承知しました。ドキュメントを読み込んでおきます。",
    },
    { speaker: "haru", channel: "shigoto", text: "進捗で詰まったら遠慮なく声かけてね。" },
  ],
};

/** 当該チャンネルの fixture メッセージを返す（未定義チャンネルは空配列）。 */
export const getFixtureMessages = (channelId: string): readonly Message[] =>
  FIXTURE_MESSAGES_BY_CHANNEL[channelId] ?? [];
