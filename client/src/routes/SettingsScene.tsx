import { Box, Button, Chip, Skeleton, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography } from "../components/uiParts";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { type SyntheticEvent, type ComponentType, type ReactElement, type ReactNode } from "react";
import { calculateCostUsd } from "@hatchery/common";
import type { TokenUsageLog } from "@hatchery/common";

import { useBatchLogs, useRefreshBatchLogs } from "../api/batchLogs.js";
import { useCommunityEngagement } from "../api/communityEngagement.js";
import { useTokenUsage, useRefreshTokenUsage } from "../api/tokenUsage.js";
import { AdminWorkerTable } from "../components/AdminWorkerTable.js";
import { CommunitiesTab } from "../components/CommunitiesTab.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { type SettingsTabValue } from "./settingsTabValues.js";

/**
 * タブパネルの Inner コンポーネントを QueryBoundary + Skeleton でラップする汎用 HOC（#596）。
 *
 * 各タブで手書きしていた「`QueryBoundary fallback={...}` → `Inner` 」の三段構造を集約する。
 * `Inner` は `useSuspenseQuery` を使うコンポーネント（データ取得待ちは Suspend、
 * エラーは throw）を想定しており、この HOC がローディング表示とエラーリカバリを担う。
 *
 * @param Inner - タブ本体（QueryBoundary の子として使う）
 * @param skeleton - ローディング中に表示する Skeleton（各タブ固有の形状を渡す）
 */
// eslint-disable-next-line max-params
export function withSettingsTabPanel<P extends object>(
  Inner: ComponentType<P>,
  skeleton: ReactNode,
): ComponentType<P> {
  const WrappedTabPanel = (props: P): ReactElement => (
    <QueryBoundary fallback={skeleton}>
      <Inner {...props} />
    </QueryBoundary>
  );
  WrappedTabPanel.displayName = `withSettingsTabPanel(${Inner.displayName ?? Inner.name ?? "Component"})`;
  return WrappedTabPanel;
}

/** タブ内のローディング表示（スケルトン行）。data-testid で各タブを識別する。 */
const TabSkeleton = ({ testId }: { testId: string }): ReactElement => (
  <Box>
    {/* eslint-disable-next-line max-params */}
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} variant="text" height={32} data-testid={testId} sx={{ my: 0.5 }} />
    ))}
  </Box>
);

const CHART_HEIGHT = 80;

/** logs を日付ごとに集計した日別コストバーチャート（#664）。新規ライブラリ依存なし。 */
const DailyCostBarChart = ({ logs }: { logs: TokenUsageLog[] }): ReactElement => {
  const dailyData: Record<string, number> = {};
  for (const log of logs) {
    const date = new Date(log.occurredAt).toISOString().slice(0, 10);
    dailyData[date] = (dailyData[date] ?? 0) + calculateCostUsd({ model: log.model, inputTokens: log.inputTokens, outputTokens: log.outputTokens });
  }
  // eslint-disable-next-line max-params
  const entries = Object.entries(dailyData).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        グラフデータがありません。
      </Typography>
    );
  }

  const maxCost = Math.max(...entries.map(([, v]) => v));
  return (
    <Box
      role="img"
      aria-label="日別コスト推移グラフ"
      sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: CHART_HEIGHT + 24, mt: 1 }}
    >
      {entries.map(([date, cost]) => {
        const barHeight = maxCost > 0 ? Math.max(2, Math.round((cost / maxCost) * CHART_HEIGHT)) : 2;
        return (
          <Box key={date} sx={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 20 }}>
            <Box
              data-testid="daily-cost-bar"
              title={`${date}: $${cost.toFixed(6)}`}
              sx={{ width: "100%", bgcolor: "primary.main", height: barHeight, borderRadius: "2px 2px 0 0" }}
            />
            <Typography variant="caption" sx={{ mt: 0.5, fontSize: "0.6rem", lineHeight: 1 }}>
              {date.slice(5)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/** バッチログタブの本体（#75）。useSuspenseQuery で取得し data は undefined を取らない。 */
const BatchLogsInner = (): ReactElement => {
  const { data: logs } = useBatchLogs();
  const refresh = useRefreshBatchLogs();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          直近 50 件のバッチ実行ログを表示します。
        </Typography>
        <Button size="small" onClick={refresh} variant="outlined">
          更新
        </Button>
      </Box>
      {logs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ログがありません。
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>実行日時</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>メッセージ数</TableCell>
              <TableCell>エラー内容</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.executedAt).toLocaleString("ja-JP")}</TableCell>
                <TableCell>
                  <Chip
                    label={log.status === "success" ? "成功" : "失敗"}
                    color={log.status === "success" ? "success" : "error"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {log.status === "success" ? log.messageCount : "-"}
                </TableCell>
                <TableCell sx={{ color: log.status === "failure" ? "error.main" : "inherit" }}>
                  {log.errorMessage ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

/** バッチログタブ（#75 / #463 / #596）。withSettingsTabPanel でローディング・エラーを扱う。 */
const BatchLogs = withSettingsTabPanel(BatchLogsInner, <TabSkeleton testId="batch-logs-skeleton" />);

/** トークン使用量タブの本体（#153 / #664）。useSuspenseQuery で取得し data は undefined を取らない。 */
const TokenUsageTabInner = (): ReactElement => {
  const { data } = useTokenUsage();
  const refresh = useRefreshTokenUsage();
  const logs = data.logs;
  const summary = data.summary;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          AI API のトークン使用量（直近 50 件）を表示します。
        </Typography>
        <Button size="small" onClick={refresh} variant="outlined">
          更新
        </Button>
      </Box>
      {summary && (
        <Box sx={{ mb: 2, p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" gutterBottom>
            合計
          </Typography>
          <Typography variant="body2">
            Input: {summary.totalInputTokens.toLocaleString()} tokens &nbsp;/&nbsp;
            Output: {summary.totalOutputTokens.toLocaleString()} tokens &nbsp;/&nbsp;
            合計: {summary.totalTokens.toLocaleString()} tokens
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: "bold" }}>
            推定コスト: ${summary.totalCostUsd.toFixed(6)}
          </Typography>
        </Box>
      )}
      {logs.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            日別コスト推移（直近 50 件から集計）
          </Typography>
          <DailyCostBarChart logs={logs} />
        </Box>
      )}
      {logs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          使用履歴がありません。
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>日時</TableCell>
              <TableCell>モデル</TableCell>
              <TableCell>Input tokens</TableCell>
              <TableCell>Output tokens</TableCell>
              <TableCell>合計 tokens</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.occurredAt).toLocaleString("ja-JP")}</TableCell>
                <TableCell>{log.model}</TableCell>
                <TableCell>{log.inputTokens.toLocaleString()}</TableCell>
                <TableCell>{log.outputTokens.toLocaleString()}</TableCell>
                <TableCell>{(log.inputTokens + log.outputTokens).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

/** トークン使用量タブ（#153 / #463 / #596）。withSettingsTabPanel でローディング・エラーを扱う。 */
const TokenUsageTab = withSettingsTabPanel(TokenUsageTabInner, <TabSkeleton testId="token-usage-skeleton" />);

/** コミュニティ帰属シグナルタブの本体（#761）。 */
const CommunityEngagementTabInner = (): ReactElement => {
  const { data } = useCommunityEngagement();

  return (
    <Box data-testid="community-engagement-tab">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        直近 {data.windowDays} 日間のコミュニティ帰属シグナルを表示します。
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          ロイヤリティスコア
        </Typography>
        <Typography variant="body1">
          {(data.loyaltyScore * 100).toFixed(1)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ユーザーが最もよく vote するコミュニティへの集中度の平均（0〜100%）
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          コミュニティ別 Vote 分布
        </Typography>
        {data.communityVotes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データがありません。
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>コミュニティ ID</TableCell>
                <TableCell align="right">Vote 数</TableCell>
                <TableCell align="right">シェア</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.communityVotes.map((entry) => (
                <TableRow key={entry.communityId}>
                  <TableCell>{entry.communityId}</TableCell>
                  <TableCell align="right">{entry.count.toLocaleString()}</TableCell>
                  <TableCell align="right">{entry.sharePercent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          ワーカー別 Vote 分布
        </Typography>
        {data.workerVotes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データがありません。
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ワーカー ID</TableCell>
                <TableCell align="right">Vote 数</TableCell>
                <TableCell align="right">シェア</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.workerVotes.map((entry) => (
                <TableRow key={entry.workerId}>
                  <TableCell>{entry.workerId}</TableCell>
                  <TableCell align="right">{entry.count.toLocaleString()}</TableCell>
                  <TableCell align="right">{entry.sharePercent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          コミュニティ別購読者数
        </Typography>
        {Object.keys(data.subscriberCountByCommunity).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            データがありません。
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>コミュニティ ID</TableCell>
                <TableCell align="right">購読者数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(data.subscriberCountByCommunity).map(([communityId, count]) => (
                <TableRow key={communityId}>
                  <TableCell>{communityId}</TableCell>
                  <TableCell align="right">{count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
};

/** コミュニティ帰属シグナルタブ（#761 / #596）。withSettingsTabPanel でローディング・エラーを扱う。 */
const CommunityEngagementTab = withSettingsTabPanel(CommunityEngagementTabInner, <TabSkeleton testId="community-engagement-skeleton" />);

/** 管理画面のタブ定義。配列駆動にして将来のタブ追加（会社設定・定時設定など）を妨げない。 */
interface SettingsTab {
  label: string;
  value: SettingsTabValue;
  content: ReactNode;
}

const SETTINGS_TABS: readonly [SettingsTab, ...SettingsTab[]] = [
  { label: "ワーカー管理", value: "users", content: <AdminWorkerTable /> },
  { label: "バッチログ", value: "batch-logs", content: <BatchLogs /> },
  { label: "トークン使用量", value: "token-usage", content: <TokenUsageTab /> },
  { label: "コミュニティ", value: "communities", content: <CommunitiesTab /> },
  { label: "帰属シグナル", value: "community-engagement", content: <CommunityEngagementTab /> },
];

/** 管理画面（/admin）。タブ UI を持ち、ユーザー一覧タブに AI 社員をテーブル表示する（#25）。 */
export const SettingsScene = (): ReactElement => {
  const { tab } = useSearch({ from: "/admin" });
  const navigate = useNavigate({ from: "/admin" });
  const active: SettingsTabValue = tab;

  // eslint-disable-next-line max-params
  const handleTabChange = (_: SyntheticEvent, value: SettingsTabValue) => {
    void navigate({ search: (prev) => ({ ...prev, tab: value }) });
  };

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        管理画面
      </Typography>
      <Tabs
        value={active}
        onChange={handleTabChange}
        aria-label="管理画面タブ"
        variant="scrollable"
        scrollButtons="auto"
      >
        {SETTINGS_TABS.map((t) => (
          <Tab
            key={t.value}
            label={t.label}
            value={t.value}
            id={`settings-tab-${t.value}`}
            aria-controls={`settings-tabpanel-${t.value}`}
          />
        ))}
      </Tabs>
      {SETTINGS_TABS.map((t) => (
        <Box
          key={t.value}
          id={`settings-tabpanel-${t.value}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${t.value}`}
          hidden={active !== t.value}
          sx={{ pt: 2 }}
        >
          {active === t.value && t.content}
        </Box>
      ))}
    </Box>
  );
};
