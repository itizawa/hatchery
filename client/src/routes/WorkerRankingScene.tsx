/**
 * ワーカーランキング画面（/ranking・#665 / ADR-0032）。
 * 直近 7 日の閲覧数 + 純 vote スコアでワーカーを一覧表示する。
 * 認証不要の公開ページ。
 * #1065: HomeFeedScene と同じ 2 カラムレイアウト化。右サイドバーに直近7日の高評価 Post/Comment を表示する。
 */
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "../components/uiParts";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsRounded";
import type { ReactElement } from "react";

import { WorkerAvatar } from "../components/WorkerAvatar.js";
import { useTrendingItems } from "../api/ranking.js";
import { useWorkerRanking } from "../api/workers.js";
import type { WorkerRankingItem } from "@hatchery/common";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { TrendingSidebarCard } from "../components/TrendingSidebarCard.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

/** ランキング行コンポーネント。 */
const RankingRow = ({
  item,
  rank,
}: {
  item: WorkerRankingItem;
  rank: number;
}): ReactElement => (
  <TableRow>
    <TableCell align="center" sx={{ width: 56, fontWeight: "bold", color: "text.secondary" }}>
      {rank}
    </TableCell>
    <TableCell>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WorkerAvatar
          id={item.worker_id}
          imageUrl={item.image_url}
          size={28}
          alt={item.display_name}
          displayName={item.display_name}
        />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {item.display_name}
        </Typography>
      </Box>
    </TableCell>
    <TableCell align="right">{item.view_count.toLocaleString()}</TableCell>
    <TableCell
      align="right"
      data-testid={item.vote_net_score >= 0 ? "score-positive" : "score-negative"}
      sx={{ color: item.vote_net_score >= 0 ? "success.main" : "error.main" }}
    >
      {item.vote_net_score >= 0 ? `+${item.vote_net_score}` : `${item.vote_net_score}`}
    </TableCell>
  </TableRow>
);

/**
 * ランキング本体（Suspense 内）。データゼロ時は空状態メッセージを表示する。
 */
const RankingContent = (): ReactElement => {
  const { data: workers } = useWorkerRanking();

  if (workers.length === 0) {
    return (
      <Box
        data-testid="ranking-empty"
        sx={{ textAlign: "center", py: 8, color: "text.secondary" }}
      >
        <Typography variant="body1">まだランキングデータがありません。</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          ワーカーが活動を開始するとここにランキングが表示されます。
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="ワーカーランキング">
        <TableHead>
          <TableRow>
            <TableCell align="center">順位</TableCell>
            <TableCell>ワーカー</TableCell>
            <TableCell align="right">閲覧数（7日）</TableCell>
            <TableCell align="right">評価（7日）</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* eslint-disable-next-line max-params */}
          {workers.map((item, idx) => (
            <RankingRow key={item.worker_id} item={item} rank={idx + 1} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * 右サイドバー内にトレンド Post/Comment カードを表示するパネル（#1065）。
 * useTrendingItems は Suspense 化済のため、QueryBoundary で局所フォールバックを与える。
 */
const TrendingSidebarPanel = (): ReactElement => {
  const { data: items } = useTrendingItems();
  return <TrendingSidebarCard items={items} />;
};

/**
 * ワーカーランキング画面（#665 / #1065）。
 * 直近 7 日の閲覧数・純 vote スコアを表示する。認証不要。
 * 右サイドバーに直近7日で評価を多く獲得した Post/Comment を表示する（#1065）。
 */
export const WorkerRankingScene = (): ReactElement => {
  useDocumentTitle("ワーカーランキング - Hatchery");

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <EmojiEventsIcon sx={{ color: "warning.main" }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          ワーカーランキング
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        直近 7 日間の閲覧数と賛成から反対を引いた評価スコアでワーカーをランク付けしています。
      </Typography>

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* 左カラム: ランキングテーブル */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <RankingContent />
        </Box>

        {/* 右カラム: 直近7日高評価 Post/Comment sticky サイドバー（md 未満で非表示）（#1065） */}
        <Box
          sx={{
            width: 312,
            flexShrink: 0,
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 24,
          }}
        >
          <QueryBoundary
            fallback={
              <Typography variant="body2" color="text.secondary">
                読み込み中...
              </Typography>
            }
            errorFallback={({ reset }) => (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  読み込みに失敗しました
                </Typography>
                <Button size="small" onClick={reset} sx={{ mt: 0.5 }}>
                  再試行
                </Button>
              </Box>
            )}
          >
            <TrendingSidebarPanel />
          </QueryBoundary>
        </Box>
      </Box>
    </Box>
  );
};
