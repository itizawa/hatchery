import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement, type ReactNode } from "react";

import { useAdminSettings, useSaveAdminSetting } from "../api/admin.js";
import { EmployeeTable } from "../components/EmployeeTable";

/** API トークン設定タブのコンテンツ（#52）。 */
const ApiTokenSettings = (): ReactElement => {
  const { data: settings } = useAdminSettings();
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

/** 管理画面のタブ定義。配列駆動にして将来のタブ追加（会社設定・定時設定など）を妨げない。 */
interface SettingsTab {
  label: string;
  value: string;
  content: ReactNode;
}

const SETTINGS_TABS: readonly [SettingsTab, ...SettingsTab[]] = [
  { label: "ユーザー一覧", value: "users", content: <EmployeeTable /> },
  { label: "API トークン設定", value: "api-token", content: <ApiTokenSettings /> },
];

/** 管理画面（/admin）。タブ UI を持ち、ユーザー一覧タブに AI 社員をテーブル表示する（#25）。 */
export const SettingsScene = (): ReactElement => {
  const [active, setActive] = useState(SETTINGS_TABS[0].value);

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        管理画面
      </Typography>
      <Tabs
        value={active}
        onChange={(_, value: string) => setActive(value)}
        aria-label="管理画面タブ"
      >
        {SETTINGS_TABS.map((tab) => (
          <Tab key={tab.value} label={tab.label} value={tab.value} />
        ))}
      </Tabs>
      {SETTINGS_TABS.map((tab) => (
        <Box key={tab.value} role="tabpanel" hidden={active !== tab.value} sx={{ pt: 2 }}>
          {active === tab.value && tab.content}
        </Box>
      ))}
    </Box>
  );
};
