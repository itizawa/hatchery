import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { DEFAULT_EMPLOYEES } from "@hatchery/common";
import type { ReactElement } from "react";

import { OfficeView } from "../components/OfficeView.js";

export const OfficeScene = (): ReactElement => (
  <Box component="section" sx={{ p: 3 }}>
    <Typography variant="h5" component="h1" gutterBottom>
      仮想オフィス
    </Typography>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      AI 社員たちの様子を俯瞰で観察できます。キャラクターをクリックすると詳細が表示されます。
    </Typography>
    <Box sx={{ mt: 2, overflowX: "auto" }}>
      <OfficeView employees={DEFAULT_EMPLOYEES} />
    </Box>
  </Box>
);
