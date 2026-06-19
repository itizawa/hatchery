import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "./uiParts";
import { DEFAULT_WORKERS, type Worker } from "@hatchery/common";

import { type ReactElement, useState } from "react";

import { EditWorkerDialog } from "./EditWorkerDialog.js";

export interface WorkerTableProps {
  /** 表示するワーカー一覧。未指定なら common の DEFAULT_WORKERS を単一情報源として描画する。 */
  workers?: readonly Worker[];
  /** true のときテーブル行をスケルトン表示する（#241）。 */
  isLoading?: boolean;
  /**
   * true のとき各行に編集ボタンを表示する（#181）。
   * admin 管理画面でのみ true にする想定。
   */
  isEditable?: boolean;
  /** 削除ボタンを表示する場合に指定するコールバック（#218）。未指定なら削除ボタン非表示。 */
  onDelete?: (id: string) => void;
  /** 削除操作中は削除ボタンを無効化する（#218）。 */
  isDeleting?: boolean;
}

const SKELETON_ROW_COUNT = 3;
const AVATAR_SIZE = 32;

export const WorkerTable = ({
  workers = DEFAULT_WORKERS,
  isLoading = false,
  isEditable = false,
  onDelete,
  isDeleting = false,
}: WorkerTableProps): ReactElement => {
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Worker | null>(null);

  const handleDeleteClick = (worker: Worker) => {
    setConfirmTarget(worker);
  };

  const handleConfirm = () => {
    if (confirmTarget && onDelete) {
      onDelete(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  const handleCancel = () => {
    setConfirmTarget(null);
  };

  return (
    <>
      <TableContainer>
        <Table size="small" aria-label="AI ワーカー一覧">
          <TableHead>
            <TableRow>
              <TableCell>画像</TableCell>
              <TableCell>表示名</TableCell>
              <TableCell>役割</TableCell>
              {isEditable && <TableCell>操作</TableCell>}
              {onDelete && <TableCell>操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? // eslint-disable-next-line max-params
                Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton
                        variant="circular"
                        width={AVATAR_SIZE}
                        height={AVATAR_SIZE}
                        data-testid="worker-table-avatar-skeleton"
                      />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" data-testid="worker-table-skeleton-item" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    {isEditable && <TableCell />}
                    {onDelete && <TableCell><Skeleton variant="text" /></TableCell>}
                  </TableRow>
                ))
              : workers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell>
                      <Avatar
                        src={worker.imageUrl}
                        alt={worker.displayName}
                        sx={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                      >
                        {worker.displayName[0]}
                      </Avatar>
                    </TableCell>
                    <TableCell>{worker.displayName}</TableCell>
                    <TableCell>{worker.role ?? "—"}</TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setEditingWorker(worker)}
                          aria-label={`編集 ${worker.displayName}`}
                        >
                          編集
                        </Button>
                      </TableCell>
                    )}
                    {onDelete && (
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => handleDeleteClick(worker)}
                          disabled={isDeleting}
                        >
                          削除
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editingWorker && (
        <EditWorkerDialog
          worker={editingWorker}
          open={true}
          onClose={() => setEditingWorker(null)}
        />
      )}
      <Dialog open={confirmTarget !== null} onClose={handleCancel}>
        <DialogTitle>ワーカーの削除</DialogTitle>
        <DialogContent>
          <Typography>
            「{confirmTarget?.displayName}」を削除しますか？
            これまでのメッセージは残りますが、表示名が「【削除済み】{confirmTarget?.displayName}」になります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={isDeleting}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} color="error" variant="contained" disabled={isDeleting}>
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
