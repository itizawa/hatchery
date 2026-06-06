import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { type ReactElement } from "react";

import { useBatchLogs, useBatchLogsRefetch } from "../api/batchLogs.js";

/** AI バッチ実行ログタブのコンテンツ（#75）。 */
export const BatchLogTab = (): ReactElement => {
  const { data: logs, isLoading, isError } = useBatchLogs();
  const refetch = useBatchLogsRefetch();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Typography color="error" variant="body2">
        バッチログの取得に失敗しました。
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Button size="small" variant="outlined" onClick={() => { void refetch(); }}>
          更新
        </Button>
      </Box>
      {!logs || logs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          バッチ実行ログはありません。
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>実行日時</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>メッセージ数</TableCell>
              <TableCell>エラー</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {new Date(log.executedAt).toLocaleString("ja-JP")}
                </TableCell>
                <TableCell>
                  <Chip
                    label={log.status === "success" ? "成功" : "失敗"}
                    color={log.status === "success" ? "success" : "error"}
                    size="small"
                  />
                </TableCell>
                <TableCell>{log.messageCount ?? "—"}</TableCell>
                <TableCell>
                  {log.errorMessage ? (
                    <Typography variant="body2" color="error" sx={{ fontSize: "0.75rem" }}>
                      {log.errorMessage}
                    </Typography>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};
