/**
 * サイト全体の定量サマリダッシュボード画面（/dashboard・#1113）。
 * コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・購読数のサマリカードと、
 * コミュニティ別内訳（view_count 降順）テーブルを表示する。認証不要の公開ページ
 * （ログイン有無に関わらず表示できる）。
 *
 * デザイン方針（CLAUDE.md デザインシステム）: Vercel Dashboard 風のフラットな枠線ベースのカード
 * （box-shadow なし）+ Reddit/Linear 風の border-bottom 区切りテーブル。アクセントカラーは
 * SLACK_COLORS.blue のみ（見出しアイコンに限定）。
 */
import type { DashboardSummary } from "@hatchery/common";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import type { ReactElement } from "react";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "../components/uiParts";
import { useDashboardSummary } from "../api/dashboard.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { SLACK_COLORS } from "../theme.js";

/** サマリカード 1 件の定義（表示順を配列で固定する）。 */
interface StatCardDef {
  key: keyof Pick<
    DashboardSummary,
    | "community_count"
    | "worker_count"
    | "post_count"
    | "comment_count"
    | "total_view_count"
    | "total_vote_count"
    | "total_subscription_count"
  >;
  label: string;
}

const STAT_CARD_DEFS: readonly StatCardDef[] = [
  { key: "community_count", label: "コミュニティ数" },
  { key: "worker_count", label: "ワーカー数" },
  { key: "post_count", label: "投稿数" },
  { key: "comment_count", label: "コメント数" },
  { key: "total_view_count", label: "累計閲覧数" },
  { key: "total_vote_count", label: "累計 vote 数" },
  { key: "total_subscription_count", label: "購読数" },
];

/** サマリカード 1 枚（枠線のみ・shadow なし・角丸 8px）。 */
const StatCard = ({ label, value }: { label: string; value: number }): ReactElement => (
  <Box
    data-testid={`stat-${label}`}
    sx={{
      border: 1,
      borderColor: "divider",
      borderRadius: "8px",
      p: 2,
      display: "flex",
      flexDirection: "column",
      gap: 0.5,
      bgcolor: "background.paper",
      minWidth: 0,
    }}
  >
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      {label}
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 700 }}>
      {value.toLocaleString()}
    </Typography>
  </Box>
);

/** サマリカード群（コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計vote数・購読数）。 */
const SummaryCards = ({ summary }: { summary: DashboardSummary }): ReactElement => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 2,
      mb: 4,
    }}
  >
    {STAT_CARD_DEFS.map((def) => (
      <StatCard key={def.key} label={def.key} value={summary[def.key]} />
    ))}
  </Box>
);

/** コミュニティ別内訳テーブル（view_count 降順・border-bottom 区切り・Reddit/Linear 風）。 */
const CommunityBreakdownTable = ({ summary }: { summary: DashboardSummary }): ReactElement => {
  if (summary.communities.length === 0) {
    return (
      <Box
        data-testid="dashboard-communities-empty"
        sx={{ textAlign: "center", py: 8, color: "text.secondary" }}
      >
        <Typography variant="body1">まだコミュニティがありません。</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="コミュニティ別内訳">
        <TableHead>
          <TableRow>
            <TableCell>コミュニティ</TableCell>
            <TableCell align="right">投稿数</TableCell>
            <TableCell align="right">購読者数</TableCell>
            <TableCell align="right">閲覧数</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {summary.communities.map((c) => (
            <TableRow key={c.community_id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {c.name}
                </Typography>
              </TableCell>
              <TableCell align="right">{c.post_count.toLocaleString()}</TableCell>
              <TableCell align="right">{c.subscriber_count.toLocaleString()}</TableCell>
              <TableCell align="right">{c.view_count.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/** ダッシュボード本体（Suspense 内）。 */
const DashboardContent = (): ReactElement => {
  const { data: summary } = useDashboardSummary();

  return (
    <>
      <SummaryCards summary={summary} />
      <CommunityBreakdownTable summary={summary} />
    </>
  );
};

/**
 * サイト全体の定量サマリダッシュボード画面（#1113）。
 * ログイン有無に関わらず表示できる（認証不要 API `GET /api/dashboard` を利用）。
 */
export const DashboardScene = (): ReactElement => {
  useDocumentTitle("ダッシュボード - Hatchery");

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <QueryStatsRoundedIcon sx={{ color: SLACK_COLORS.blue }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          ダッシュボード
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Hatchery 全体の定量データです。コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・
        累計 vote 数・購読数と、コミュニティ別の内訳を表示します。
      </Typography>

      <DashboardContent />
    </Box>
  );
};
