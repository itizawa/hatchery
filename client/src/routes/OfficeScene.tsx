import { Box, Typography } from "../components/uiParts";

import type { ReactElement } from "react";

import { useBotEmployees } from "../api/employees.js";
import { OfficeView } from "../components/OfficeView.js";

function OfficeContent(): ReactElement {
  const { data: employees } = useBotEmployees();
  return (
    <Box sx={{ mt: 2, overflowX: "auto" }}>
      <OfficeView employees={employees} />
    </Box>
  );
}

export const OfficeScene = (): ReactElement => (
  <Box component="section" sx={{ p: 3 }}>
    <Typography variant="h5" component="h1" gutterBottom>
      仮想オフィス
    </Typography>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      AI 社員たちの様子を俯瞰で観察できます。キャラクターをクリックすると詳細が表示されます。
    </Typography>
    <OfficeContent />
  </Box>
);
