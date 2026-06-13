import { Box, Button } from "./uiParts";

import { useState, type ReactElement } from "react";

import { useAdminWorkers } from "../api/admin.js";
import { AddWorkerDialog } from "./AddWorkerDialog.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { WorkerTable } from "./WorkerTable.js";

/** 「社員を追加」ボタン（ローディング・成功で共有するヘッダ）。 */
const AddWorkerButton = ({ onClick }: { onClick: () => void }): ReactElement => (
  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
    <Button variant="contained" size="small" onClick={onClick} aria-label="社員を追加">
      社員を追加
    </Button>
  </Box>
);

/**
 * ローディング中の fallback（QueryBoundary の fallback として使う・#463）。
 * 「社員を追加」ボタンと WorkerTable のスケルトン行を表示して従来の見た目を維持する。
 */
const AdminWorkerTableSkeleton = (): ReactElement => (
  <Box>
    <AddWorkerButton onClick={() => {}} />
    <WorkerTable workers={[]} isLoading isEditable />
  </Box>
);

/**
 * 管理画面のワーカー一覧本体（#217 / #329 / #490）。
 * useSuspenseQuery で全 Worker を取得し WorkerTable に渡す（data は undefined を取らない）。
 * ローディング・エラーは外側の QueryBoundary に委譲する。
 */
const AdminWorkerTableInner = (): ReactElement => {
  const { data: workers } = useAdminWorkers();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box>
      <AddWorkerButton onClick={() => setDialogOpen(true)} />
      <WorkerTable workers={workers} isEditable />
      <AddWorkerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
};

/**
 * 管理画面のワーカー一覧タブ用コンポーネント（#217 / #329 / #490 / #463）。
 * useSuspenseQuery で取得し、QueryBoundary（Suspense + ErrorBoundary）で
 * ローディング（スケルトン）と取得失敗（再試行フォールバック）をまとめて扱う。
 */
export const AdminWorkerTable = (): ReactElement => (
  <QueryBoundary fallback={<AdminWorkerTableSkeleton />}>
    <AdminWorkerTableInner />
  </QueryBoundary>
);
