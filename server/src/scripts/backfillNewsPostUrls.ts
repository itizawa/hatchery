/**
 * news コミュニティに残る、#927/#1022 修正前に生成された投稿の
 * タイトル・本文からはてなブックマークURLの露出をバックフィルで除去するワンショットスクリプト（#1117）。
 *
 * 使い方:
 *   pnpm --filter @hatchery/server backfill:news-post-urls
 *
 * #927（本文へのURL露出防止）・#1022（タイトルへのURL露出防止）はプロンプト修正のみが目的で、
 * 修正前に生成され既に永続化済みの投稿にはURLが残ったまま。生成ロジック自体には回帰が無いことを
 * 確認済みのため、本スクリプトは純粋に既存データのクリーンアップを行う。
 */

import { hasLeadingUrlExposure, hasTrailingUrlExposure, stripLeadingUrlLineFromPostText, stripTrailingUrlSuffixFromPostTitle } from "@hatchery/common";
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import { createPrismaCommunityRepository } from "../persistence/prismaCommunityRepository.js";
import { createPrismaPostRepository } from "../persistence/prismaPostRepository.js";

/** バックフィル対象の community slug（#1117: news コミュニティのみが対象）。 */
const TARGET_COMMUNITY_SLUG = "news";

/** community 内 post の走査上限件数。news コミュニティの実データ規模を踏まえた実用上の上限（#1117）。 */
const BACKFILL_SCAN_LIMIT = 10000;

/** バックフィル結果。 */
export interface BackfillResult {
  updatedCount: number;
  updatedIds: string[];
}

/**
 * news コミュニティの post のうち、本文冒頭またはタイトル末尾にURLが露出しているものを抽出し
 * title/text を更新するコアロジック。
 * DB アクセスは既存の CommunityRepository / PostRepository（永続化層）に委譲するため、
 * テストは in-memory 実装を注入して DB 接続なしで行える。
 */
export async function runBackfillNewsPostUrls({
  communityRepository,
  postRepository,
}: {
  communityRepository: CommunityRepository;
  postRepository: PostRepository;
}): Promise<BackfillResult> {
  const community = await communityRepository.findBySlug(TARGET_COMMUNITY_SLUG);
  if (!community) return { updatedCount: 0, updatedIds: [] };

  const posts = await postRepository.listByCommunity(community.id, BACKFILL_SCAN_LIMIT);

  const updatedIds: string[] = [];
  for (const post of posts) {
    const leadingExposed = hasLeadingUrlExposure(post.text);
    const trailingExposed = hasTrailingUrlExposure(post.title);
    if (!leadingExposed && !trailingExposed) continue;

    const strippedText = leadingExposed ? stripLeadingUrlLineFromPostText(post.text) : post.text;
    const strippedTitle = trailingExposed ? stripTrailingUrlSuffixFromPostTitle(post.title) : post.title;
    // 除去後に空文字になる場合は PostSchema の min(1) 制約に反する可能性があるため、
    // その項目は更新せず元の値を維持する（安全側に倒す・#1117）。
    const newText = strippedText.trim().length > 0 ? strippedText : post.text;
    const newTitle = strippedTitle.trim().length > 0 ? strippedTitle : post.title;
    if (newText === post.text && newTitle === post.title) continue;

    const updated = await postRepository.updateTitleAndText({ id: post.id, title: newTitle, text: newText });
    if (updated) updatedIds.push(post.id);
  }

  return { updatedCount: updatedIds.length, updatedIds };
}

/**
 * CLI エントリポイント。
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const communityRepository = createPrismaCommunityRepository(prisma);
    const postRepository = createPrismaPostRepository(prisma);
    const result = await runBackfillNewsPostUrls({ communityRepository, postRepository });

    if (result.updatedCount === 0) {
      console.log("バックフィル対象のURL露出投稿はありませんでした。");
      return;
    }

    console.log(`${result.updatedCount} 件の投稿の title/text を更新しました。`);
    console.log(`対象 post id: ${result.updatedIds.join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接実行（tsx src/scripts/backfillNewsPostUrls.ts）のときだけ main を起動する。
// テストからの import ではスクリプトを実行しない。cleanupDeadWorkerAvatarUrls.ts と同じ確立済みパターン。
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("予期しないエラーが発生しました:", err);
    process.exit(1);
  });
}
