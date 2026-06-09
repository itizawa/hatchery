import { Avatar, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "./uiParts";
import { DEFAULT_EMPLOYEES, type Employee } from "@hatchery/common";

import { type ReactElement, useState } from "react";

import { Button } from "./uiParts";
import { EditEmployeeDialog } from "./EditEmployeeDialog.js";

export interface EmployeeTableProps {
  /** 表示する社員一覧。未指定なら common の DEFAULT_EMPLOYEES を単一情報源として描画する。 */
  employees?: readonly Employee[];
  /** true のときテーブル行をスケルトン表示する（#241）。 */
  isLoading?: boolean;
  /**
   * true のとき各行に編集ボタンを表示する（#181）。
   * admin 管理画面でのみ true にする想定。
   */
  isEditable?: boolean;
}

const SKELETON_ROW_COUNT = 3;
const AVATAR_SIZE = 32;

/**
 * AI 社員（AI ボット）の一覧テーブル（presentational）。
 * 既定では common の DEFAULT_EMPLOYEES を直接描画する（client → common の一方向依存）。
 * role は任意項目のため、未設定時は "—" でフォールバック表示する。
 * imageUrl が設定されている場合は Avatar で画像を表示し、未設定時はイニシャルでフォールバック表示する（#220）。
 * isEditable=true のとき各行に編集ボタンを表示し、EditEmployeeDialog を開く（#181）。
 */
export const EmployeeTable = ({
  employees = DEFAULT_EMPLOYEES,
  isLoading = false,
  isEditable = false,
}: EmployeeTableProps): ReactElement => {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  return (
    <>
      <TableContainer>
        <Table size="small" aria-label="AI 社員一覧">
          <TableHead>
            <TableRow>
              <TableCell>画像</TableCell>
              <TableCell>表示名</TableCell>
              <TableCell>役割</TableCell>
              {isEditable && <TableCell>操作</TableCell>}
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
                        data-testid="employee-table-avatar-skeleton"
                      />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" data-testid="employee-table-skeleton-item" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    {isEditable && <TableCell />}
                  </TableRow>
                ))
              : employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Avatar
                        src={employee.imageUrl}
                        alt={employee.displayName}
                        sx={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                      >
                        {employee.displayName[0]}
                      </Avatar>
                    </TableCell>
                    <TableCell>{employee.displayName}</TableCell>
                    <TableCell>{employee.role ?? "—"}</TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setEditingEmployee(employee)}
                          aria-label={`編集 ${employee.displayName}`}
                        >
                          編集
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editingEmployee && (
        <EditEmployeeDialog
          employee={editingEmployee}
          open={true}
          onClose={() => setEditingEmployee(null)}
        />
      )}
    </>
  );
};
