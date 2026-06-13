import { Box, Button } from "./uiParts";

import { useState, type ReactElement } from "react";

import { useAdminWorkers } from "../api/admin.js";
import { AddWorkerDialog } from "./AddWorkerDialog.js";
import { WorkerTable } from "./WorkerTable.js";

/**
 * 管理画面のワーカー一覧タブ用コンポーネント（#217 / #329 / #490）。
 * DB から全 Worker を取得して WorkerTable に渡す。
 * 「社員を追加」ボタンをヘッダに配置し、AddWorkerDialog を開く。
 * 各行は編集可能（isEditable）で、編集ダイアログから参加コミュニティも編集できる（#490）。
 */
export const AdminWorkerTable = (): ReactElement => {
  const { data: workers = [], isLoading } = useAdminWorkers();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => setDialogOpen(true)}
          aria-label="社員を追加"
        >
          社員を追加
        </Button>
      </Box>
      <WorkerTable workers={workers} isLoading={isLoading} isEditable />
      <AddWorkerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
};
