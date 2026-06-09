import { type MessageRecord } from "@hatchery/common";

/**
 * チャンネル詳細画面（#30）の動作確認用 fixture（プレースホルダ）。
 * 実 API（型共有パイプライン #8/#41 / 定時バッチ #32）が整うまでの暂定データで、
 * Story と ChannelScene コンテナが共有する（単一情報源・DRY）。
 * チャンネル ID をキーに、そのチャンネルに属する message[] を返す。
 */
const BASE_DATE = new Date("2026-06-05T09:00:00Z");
const minutesLater = (n: number) => new Date(BASE_DATE.getTime() + n * 60_000);

export const FIXTURE_MESSAGES_BY_CHANNEL: Readonly<Record<string, readonly MessageRecord[]>> = {
  zatsudan: [
    {
      id: "fixture-z-1",
      createdEmployeeId: "haru",
      channel: "zatsudan",
      text: "おはようございます！今日もはりきっていきましょう。",
      postedAt: minutesLater(0),
      createdAt: minutesLater(0),
      order: 0,
    },
    {
      id: "fixture-z-2",
      createdEmployeeId: "ken",
      channel: "zatsudan",
      text: "おはよう。コーヒー淡れてきたよ。",
      postedAt: minutesLater(1),
      createdAt: minutesLater(1),
      order: 1,
    },
    {
      id: "fixture-z-3",
      createdEmployeeId: "mei",
      channel: "zatsudan",
      text: "おはようございます！よろしくお願いします。",
      postedAt: minutesLater(2),
      createdAt: minutesLater(2),
      order: 2,
    },
    {
      id: "fixture-z-4",
      createdEmployeeId: "haru",
      channel: "zatsudan",
      text: "そういえば昨日のランチ美味しかったね。",
      postedAt: minutesLater(3),
      createdAt: minutesLater(3),
      order: 3,
    },
  ],
  shigoto: [
    {
      id: "fixture-s-1",
      createdEmployeeId: "ken",
      channel: "shigoto",
      text: "今日のタスク、まず仕様の確認から始めよう。",
      postedAt: minutesLater(0),
      createdAt: minutesLater(0),
      order: 0,
    },
    {
      id: "fixture-s-2",
      createdEmployeeId: "mei",
      channel: "shigoto",
      text: "承知しました。ドキュメントを読み込んでおきます。",
      postedAt: minutesLater(1),
      createdAt: minutesLater(1),
      order: 1,
    },
    {
      id: "fixture-s-3",
      createdEmployeeId: "haru",
      channel: "shigoto",
      text: "進捗で詰まったら遠慮なく声かけてね。",
      postedAt: minutesLater(2),
      createdAt: minutesLater(2),
      order: 2,
    },
  ],
};

/** 当該チャンネルの fixture メッセージを返す（未定義チャンネルは空配列）。 */
export const getFixtureMessages = (channelId: string): readonly MessageRecord[] =>
  FIXTURE_MESSAGES_BY_CHANNEL[channelId] ?? [];
