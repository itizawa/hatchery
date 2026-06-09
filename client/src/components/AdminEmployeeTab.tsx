import type { Employee } from "@hatchery/common";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BOT_EMPLOYEES_QUERY_KEY, useBotEmployees } from "../api/employees.js";
import { Avatar, Box, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "./uiParts";
import { WorkerImageUpload } from "./WorkerImageUpload.js";

const SKELETON_ROW_COUNT = 3;
const AVATAR_SIZE = 40;

/**
 * admin 管理画面用の AI ワーカー一覧タブ（#204）。
 * サーバから Bot Employee を取得して一覧表示し、
 * 各行にアバター画像アップロード機能を提供する。
 */
export const AdminEmployeeTab = (): ReactElement => {
  const queryClient = useQueryClient();
  const { data: employees, isLoading } = useBotEmployees();

  const handleUploadSuccess = (result: { id: string; imageUrl: string }) => {
    // 成功したワーカーの imageUrl を楽観的に更新する
    queryClient.setQueryData<Employee[]>(BOT_EMPLOYEES_QUERY_KEY, (old) =>
      old?.map((e) =>
        e.id === result.id ? { ...e, imageUrl: result.imageUrl } : e,
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
                        data-testid="admin-employee-avatar-skeleton"
                      />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" data-testid="admin-employee-name-skeleton" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                  </TableRow>
                ))
              : (employees ?? []).map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <WorkerImageUpload
                        employeeId={employee.id}
                        displayName={employee.displayName}
                        currentImageUrl={employee.imageUrl ?? null}
                        onSuccess={handleUploadSuccess}
                      />
                    </TableCell>
                    <TableCell>{employee.displayName}</TableCell>
                    <TableCell>
                      {employee.role ?? (
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
