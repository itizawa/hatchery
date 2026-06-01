import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement, type ReactNode } from "react";

import { EmployeeTable } from "../components/EmployeeTable";

/** 管理画面のタブ定義。配列駆動にして将来のタブ追加（会社設定・定時設定など）を妨げない。 */
interface SettingsTab {
  label: string;
  value: string;
  content: ReactNode;
}

const SETTINGS_TABS: readonly [SettingsTab, ...SettingsTab[]] = [
  { label: "ユーザー一覧", value: "users", content: <EmployeeTable /> },
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
