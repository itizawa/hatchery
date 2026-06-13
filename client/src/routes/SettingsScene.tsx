import { Alert, Box, Button, Chip, Skeleton, Snackbar, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "../components/uiParts";

import { useForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type SyntheticEvent, useState, type ReactElement, type ReactNode } from "react";

import { APP_SETTING_VALUE_MAX_LENGTH } from "@hatchery/common";
import { useAdminSettings, useSaveAdminSetting } from "../api/admin.js";
import { useBatchLogs, useRefreshBatchLogs } from "../api/batchLogs.js";
import { useTokenUsage, useRefreshTokenUsage } from "../api/tokenUsage.js";
import { AdminWorkerTable } from "../components/AdminWorkerTable.js";
import { CommunitiesTab } from "../components/CommunitiesTab.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { type SettingsTabValue } from "./settingsTabValues.js";

/** タブ内のローディング表示（スケルトン行）。data-testid で各タブを識別する。 */
const TabSkeleton = ({ testId }: { testId: string }): ReactElement => (
  <Box>
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} variant="text" height={32} data-testid={testId} sx={{ my: 0.5 }} />
    ))}
  </Box>
);

/** API トークン設定タブのローディング表示（QueryBoundary の fallback・#463）。 */
const ApiTokenSettingsSkeleton = (): ReactElement => (
  <Box sx={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 2 }}>
    <Skeleton variant="text" height={24} width="60%" data-testid="api-token-skeleton" />
    <Skeleton variant="text" height={40} />
  </Box>
);

/** API トークン設定タブの本体（#52）。useSuspenseQuery で取得し data は undefined を取らない。 */
const ApiTokenSettingsInner = (): ReactElement => {
  const { data: settings } = useAdminSettings();
  const saveMutation = useSaveAdminSetting();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  const currentMasked =
    settings.find((s) => s.key === "CLAUDE_API_KEY")?.maskedValue ?? null;

  const form = useForm({
    defaultValues: { apiKey: "" },
    onSubmit: async ({ value }) => {
      try {
        await saveMutation.mutateAsync({ key: "CLAUDE_API_KEY", value: value.apiKey });
        form.reset();
        setSnackbarOpen(true);
      } catch {
        setErrorOpen(true);
      }
    },
  });

  return (
    <Box
      component="form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
      }}
      sx={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        Claude API キーを設定します。設定済みの場合はマスク表示で確認できます。
      </Typography>
      {currentMasked && (
        <Typography variant="body2">
          現在の設定: <strong>{currentMasked}</strong>
        </Typography>
      )}
      <form.Field name="apiKey">
        {(field) => (
          <TextField
            label="Claude API キー"
            type="password"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder="sk-ant-api03-..."
            fullWidth
            size="small"
            inputProps={{ maxLength: APP_SETTING_VALUE_MAX_LENGTH, autoComplete: "off" }}
          />
        )}
      </form.Field>
      <Button
        type="submit"
        variant="contained"
        disabled={saveMutation.isPending}
      >
        保存
      </Button>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          APIキーを保存しました
        </Alert>
      </Snackbar>
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
      >
        <Alert severity="error" onClose={() => setErrorOpen(false)}>
          APIキーの保存に失敗しました
        </Alert>
      </Snackbar>
    </Box>
  );
};

/** API トークン設定タブ（#52 / #463）。QueryBoundary でローディング・エラーを扱う。 */
const ApiTokenSettings = (): ReactElement => (
  <QueryBoundary fallback={<ApiTokenSettingsSkeleton />}>
    <ApiTokenSettingsInner />
  </QueryBoundary>
);

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

/** バッチログタブ（#75 / #463）。QueryBoundary でローディング・エラーを扱う。 */
const BatchLogs = (): ReactElement => (
  <QueryBoundary fallback={<TabSkeleton testId="batch-logs-skeleton" />}>
    <BatchLogsInner />
  </QueryBoundary>
);

/** トークン使用量タブの本体（#153）。useSuspenseQuery で取得し data は undefined を取らない。 */
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

/** トークン使用量タブ（#153 / #463）。QueryBoundary でローディング・エラーを扱う。 */
const TokenUsageTab = (): ReactElement => (
  <QueryBoundary fallback={<TabSkeleton testId="token-usage-skeleton" />}>
    <TokenUsageTabInner />
  </QueryBoundary>
);

/** 管理画面のタブ定義。配列駆動にして将来のタブ追加（会社設定・定時設定など）を妨げない。 */
interface SettingsTab {
  label: string;
  value: SettingsTabValue;
  content: ReactNode;
}

const SETTINGS_TABS: readonly [SettingsTab, ...SettingsTab[]] = [
  { label: "ワーカー管理", value: "users", content: <AdminWorkerTable /> },
  { label: "API トークン設定", value: "api-token", content: <ApiTokenSettings /> },
  { label: "バッチログ", value: "batch-logs", content: <BatchLogs /> },
  { label: "トークン使用量", value: "token-usage", content: <TokenUsageTab /> },
  { label: "コミュニティ", value: "communities", content: <CommunitiesTab /> },
];

/** 管理画面（/admin）。タブ UI を持ち、ユーザー一覧タブに AI 社員をテーブル表示する（#25）。 */
export const SettingsScene = (): ReactElement => {
  const { tab } = useSearch({ from: "/admin" });
  const navigate = useNavigate({ from: "/admin" });
  const active: SettingsTabValue = tab;

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
