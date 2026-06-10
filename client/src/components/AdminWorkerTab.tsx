import type { Worker } from "@hatchery/common";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BOT_WORKERS_QUERY_KEY, useBotWorkers } from "../api/workers.js";
import { Avatar, Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "./uiParts";
import { WorkerImageUpload } from "./WorkerImageUpload.js";

const SKELETON_ROW_COUNT = 3;
const AVATAR_SIZE = 40;

/**
 * admin 管理画面用の AI ワーカー一覧タブ（#204 / #329）。
 * サーバから Bot Worker を取得して一覧表示し、
 * 各行にアバター画像アップロード機能を提供する。
 */
export const AdminWorkerTab = (): ReactElement => {
  const queryClient = useQueryClient();
  const { data: workers, isLoading } = useBotWorkers();

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
          <TableHead>
            <TableRow>
              <TableCell>アバター</TableCell>
              <TableCell>表示名</TableCell>
              <TableCell>役割</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
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
                ))
              : (workers ?? []).map((worker) => (
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

export { Avatar, AVATAR_SIZE };
