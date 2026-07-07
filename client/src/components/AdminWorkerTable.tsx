import { Alert, Box, Button, Snackbar, TablePagination } from "./uiParts";

import { useEffect, useState, type ReactElement } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { ADMIN_WORKERS_PAGE_SIZE, useAdminWorkers } from "../api/admin.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { WorkerTable } from "./WorkerTable.js";

/** 「ワーカーを追加」ボタン（ローディング・成功で共有するヘッダ）。 */
const AddWorkerButton = ({ onClick }: { onClick: () => void }): ReactElement => (
  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
    <Button variant="contained" size="small" onClick={onClick} aria-label="ワーカーを追加">
      ワーカーを追加
    </Button>
  </Box>
);

/**
 * ローディング中の fallback（QueryBoundary の fallback として使う・#463）。
 * 「ワーカーを追加」ボタンと WorkerTable のスケルトン行を表示して従来の見た目を維持する。
 */
const AdminWorkerTableSkeleton = (): ReactElement => (
  <Box>
    <AddWorkerButton onClick={() => {}} />
    <WorkerTable workers={[]} isLoading isEditable />
  </Box>
);

/**
 * 管理画面のワーカー一覧本体（#217 / #329 / #490 / #545 / #888）。
 * サーバーサイドページネーション（10件/ページ）で Worker を取得し WorkerTable に渡す。
 * ローディング・エラーは外側の QueryBoundary に委譲する。
 * 「ワーカーを追加」ボタンは /admin/workers/new へ遷移する（#888）。
 */
const AdminWorkerTableInner = (): ReactElement => {
  const [page, setPage] = useState(0); // MUI TablePagination は 0-indexed
  const { data } = useAdminWorkers(page + 1); // API は 1-indexed
  const navigate = useNavigate();
  const { workerSaved } = useSearch({ from: "/admin" });
  const [showSavedSnackbar, setShowSavedSnackbar] = useState(false);

  // #1080: ワーカー編集の保存成功後に付与される一時フラグ。検知したら
  // Snackbar を表示しつつ URL から即座に除去し、再訪問時の再表示を防ぐ。
  useEffect(() => {
    if (workerSaved) {
      setShowSavedSnackbar(true);
      void navigate({ to: "/admin", search: { tab: "users" }, replace: true });
    }
  }, [workerSaved]);

  const handleAddWorker = (): void => {
    void navigate({ to: "/admin/workers/new" });
  };

  return (
    <Box>
      <AddWorkerButton onClick={handleAddWorker} />
      <WorkerTable workers={data.workers} isEditable />
      <TablePagination
        component="div"
        count={data.total}
        page={page}
        rowsPerPage={ADMIN_WORKERS_PAGE_SIZE}
        rowsPerPageOptions={[ADMIN_WORKERS_PAGE_SIZE]}
        // eslint-disable-next-line max-params
        onPageChange={(_, newPage) => setPage(newPage)}
      />
      <Snackbar
        open={showSavedSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSavedSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setShowSavedSnackbar(false)}>
          ワーカーを保存しました
        </Alert>
      </Snackbar>
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
