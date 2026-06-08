import { Alert, Box, Button, Chip, Skeleton, Snackbar, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "../components/uiParts";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { type SyntheticEvent, useState, type ReactElement, type ReactNode } from "react";

import { APP_SETTING_VALUE_MAX_LENGTH } from "@hatchery/common";
import { useAdminSettings, useSaveAdminSetting } from "../api/admin.js";
import { useBatchLogs, useRefreshBatchLogs } from "../api/batchLogs.js";
import { EmployeeTable } from "../components/EmployeeTable";
import { InvitationsTab } from "../components/InvitationsTab.js";
import { type SettingsTabValue } from "./settingsTabValues.js";

/** API トークン設定タブのコンテンツ（#52）。 */
const ApiTokenSettings = (): ReactElement => {
  const { data: settings, isLoading: isSettingsLoading } = useAdminSettings();
  const saveMutation = useSaveAdminSetting();
  const [apiKey, setApiKey] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  const currentMasked =
    settings?.find((s) => s.key === "CLAUDE_API_KEY")?.maskedValue ?? null;

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ key: "CLAUDE_API_KEY", value: apiKey });
      setApiKey("");
      setSnackbarOpen(true);
    } catch {
      setErrorOpen(true);
    }
  };

  if (isSettingsLoading) {
    return (
      <Box sx={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 2 }}>
        <Skeleton variant="text" height={24} width="60%" data-testid="api-token-skeleton" />
        <Skeleton variant="text" height={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Claude API キーを設定します。設定済みの場合はマスク表示で確認できます。
      </Typography>
      {currentMasked && (
        <Typography variant="body2">
          現在の設定: <strong>{currentMasked}</strong>
        </Typography>
      )}
      <TextField
        label="Claude API キー"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-ant-api03-..."
        fullWidth
        size="small"
        inputProps={{ maxLength: APP_SETTING_VALUE_MAX_LENGTH, autoComplete: "off" }}
      />
      <Button
        variant="contained"
        onClick={handleSave}
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

/** バッチログタブのコンテンツ（#75）。 */
const BatchLogs = (): ReactElement => {
  const { data: logs = [], isLoading: isLogsLoading } = useBatchLogs();
  const refresh = useRefreshBatchLogs();

  if (isLogsLoading) {
    return (
      <Box>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="text" height={32} data-testid="batch-logs-skeleton" sx={{ my: 0.5 }} />
        ))}
      </Box>
    );
  }

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

/** 管理画面のタブ定義。配列駆動にして将来のタブ追加（会社設定・定時設定など）を妨げない。 */
interface SettingsTab {
  label: string;
  value: SettingsTabValue;
  content: ReactNode;
}

const SETTINGS_TABS: readonly [SettingsTab, ...SettingsTab[]] = [
  { label: "ユーザー一覧", value: "users", content: <EmployeeTable /> },
  { label: "API トークン設定", value: "api-token", content: <ApiTokenSettings /> },
  { label: "バッチログ", value: "batch-logs", content: <BatchLogs /> },
  { label: "招待", value: "invitations", content: <InvitationsTab /> },
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
