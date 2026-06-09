import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "./uiParts";
import { DEFAULT_EMPLOYEES, type Employee } from "@hatchery/common";

import type { ReactElement } from "react";

export interface EmployeeTableProps {
  /** 表示する社員一覧。未指定なら common の DEFAULT_EMPLOYEES を単一情報源として描画する。 */
  employees?: readonly Employee[];
  /** true のときテーブル行をスケルトン表示する（#241）。 */
  isLoading?: boolean;
}

const SKELETON_ROW_COUNT = 3;

/**
 * AI 社員（AI ボット）の一覧テーブル（presentational）。
 * 既定では common の DEFAULT_EMPLOYEES を直接描画する（client → common の一方向依存）。
 * role は任意項目のため、未設定時は "—" でフォールバック表示する。
 */
export const EmployeeTable = ({ employees = DEFAULT_EMPLOYEES, isLoading = false }: EmployeeTableProps): ReactElement => (
  <TableContainer>
    <Table size="small" aria-label="AI 社員一覧">
      <TableHead>
        <TableRow>
          <TableCell>表示名</TableCell>
          <TableCell>役割</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading
          ? Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton variant="text" data-testid="employee-table-skeleton-item" />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
            ))
          : employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.displayName}</TableCell>
                <TableCell>{employee.role ?? "—"}</TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  </TableContainer>
);
