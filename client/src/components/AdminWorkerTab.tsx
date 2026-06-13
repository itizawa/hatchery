import type { Worker } from "@hatchery/common";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BOT_WORKERS_QUERY_KEY, useBotWorkers } from "../api/workers.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { Avatar, Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "./uiParts";
import { WorkerImageUpload } from "./WorkerImageUpload.js";

const SKELETON_ROW_COUNT = 3;
const AVATAR_SIZE = 40;

/** AI ワーカー一覧テーブルのヘッダ（成功・ローディング双方で共有する）。 */
const WorkerTableHead = (): ReactElement => (
  <TableHead>
    <TableRow>
      <TableCell>アバター</TableCell>
      <TableCell>表示名</TableCell>
      <TableCell>役割</TableCell>
    </TableRow>
  </TableHead>
);

/**
 * ローディング中に表示するスケルトン（QueryBoundary の fallback として使う・#463）。
 * 取得待ちの間、ヘッダ + スケルトン行を表示して従来の見た目を維持する。
 */
const AdminWorkerTabSkeleton = (): ReactElement => (
  <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      AI ワーカーの一覧です。アバターをクリックして画像をアップロードできます（admin のみ）。
    </Typography>
    <TableContainer>
      <Table size="small" aria-label="AI ワーカー一覧">
        <WorkerTableHead />
        <TableBody>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton
                  variant="circular"
                  width={AVATAR_SIZE}
                  height={AVATAR_SIZE}
                  data-testid="admin-worker-avatar-skeleton"
                />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" data-testid="admin-worker-name-skeleton" />
              </TableCell>
              <TableCell>
                <Skeleton variant="text" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

/**
 * AI ワーカー一覧の本体（#204 / #329）。useSuspenseQuery で取得するため、
 * ローディング・エラーは外側の QueryBoundary に委譲する（data は undefined を取らない）。
 */
const AdminWorkerTabInner = (): ReactElement => {
  const queryClient = useQueryClient();
  const { data: workers } = useBotWorkers();

  const handleUploadSuccess = (result: { id: string; imageUrl: string }) => {
    // 成功したワーカーの imageUrl を楽観的に更新する
    queryClient.setQueryData<Worker[]>(BOT_WORKERS_QUERY_KEY, (old) =>
      old?.map((w) =>
        w.id === result.id ? { ...w, imageUrl: result.imageUrl } : w,
      ),
    );
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        AI ワーカーの一覧です。アバターをクリックして画像をアップロードできます（admin のみ）。
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="AI ワーカー一覧">
          <WorkerTableHead />
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={worker.id}>
                <TableCell>
                  <WorkerImageUpload
                    workerId={worker.id}
                    displayName={worker.displayName}
                    currentImageUrl={worker.imageUrl ?? null}
                    onSuccess={handleUploadSuccess}
                  />
                </TableCell>
                <TableCell>{worker.displayName}</TableCell>
                <TableCell>
                  {worker.role ?? (
                    <Typography component="span" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

/**
 * admin 管理画面用の AI ワーカー一覧タブ（#204 / #329 / #463）。
 * useSuspenseQuery で取得し、QueryBoundary（Suspense + ErrorBoundary）で
 * ローディング（スケルトン）と取得失敗（再試行フォールバック）をまとめて扱う。
 */
export const AdminWorkerTab = (): ReactElement => (
  <QueryBoundary fallback={<AdminWorkerTabSkeleton />}>
    <AdminWorkerTabInner />
  </QueryBoundary>
);

export { Avatar, AVATAR_SIZE };
