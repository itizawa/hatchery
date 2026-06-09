import { Box, Typography } from "../components/uiParts";

import type { ReactElement } from "react";

import { useBotEmployees } from "../api/employees.js";
import { OfficeView } from "../components/OfficeView.js";

function OfficeContent(): ReactElement {
  const { data: employees, isLoading, error } = useBotEmployees();
  if (isLoading) return <Typography variant="body2">読み込み中...</Typography>;
  if (error)
    return (
      <Typography variant="body2" color="error">
        社員データの取得に失敗しました。
      </Typography>
    );
  return (
    <Box data-testid="office-scroll-container" sx={{ mt: 2, width: "100%" }}>
      <OfficeView employees={employees ?? []} />
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
