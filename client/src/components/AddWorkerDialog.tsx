import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "./uiParts";

import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";

import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";
import { useCreateAdminWorker } from "../api/admin.js";
import { useSetWorkerCommunities } from "../api/workerCommunities.js";
import { WorkerCommunitiesField } from "./WorkerCommunitiesField.js";

interface AddWorkerDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 管理画面のワーカー一覧タブで AI ワーカーを追加するモーダル（#217 / #329 / #490）。
 * フォームは @tanstack/react-form の useForm を使用（useState によるフォーム管理禁止）。
 * 作成後に、選択された参加コミュニティを `WorkerCommunity` に反映する（#490）。
 */
export const AddWorkerDialog = ({ open, onClose }: AddWorkerDialogProps): ReactElement => {
  const createWorker = useCreateAdminWorker();
  const setCommunities = useSetWorkerCommunities();

  const form = useForm({
    defaultValues: {
      displayName: "",
      role: "",
      communityIds: [] as string[],
    },
    onSubmit: async ({ value }) => {
      const created = await createWorker.mutateAsync({
        displayName: value.displayName.trim(),
        role: value.role.trim() || undefined,
      });
      // 作成された worker に参加コミュニティを反映する（#490）。
      // 空配列のときも明示的に置換 API を呼び、状態を確定させる（冪等）。
      await setCommunities.mutateAsync({
        workerId: created.id,
        communityIds: value.communityIds,
      });
      form.reset();
      onClose();
    },
  });

  const handleClose = (): void => {
    form.reset();
    onClose();
  };

  const isPending = createWorker.isPending || setCommunities.isPending;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>社員を追加</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <form.Field
            name="displayName"
            validators={{
              onSubmit: ({ value }) => (!value.trim() ? "表示名は必須です" : undefined),
            }}
          >
            {(field) => (
              <TextField
                size="small"
                label="表示名"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                inputProps={{ "aria-label": "表示名", maxLength: WORKER_DISPLAY_NAME_MAX_LENGTH }}
                error={field.state.meta.errors.length > 0}
                helperText={field.state.meta.errors[0] ?? ""}
                autoFocus
                fullWidth
                required
              />
            )}
          </form.Field>
          <form.Field name="role">
            {(field) => (
              <TextField
                size="small"
                label="役割（任意）"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                inputProps={{ "aria-label": "役割（任意）", maxLength: WORKER_ROLE_MAX_LENGTH }}
                fullWidth
              />
            )}
          </form.Field>
          <form.Field name="communityIds">
            {(field) => (
              <WorkerCommunitiesField
                labelId="add-worker-communities-label"
                value={field.state.value}
                onChange={(ids) => field.handleChange(ids)}
              />
            )}
          </form.Field>
          {(createWorker.isError || setCommunities.isError) && (
            <Typography variant="caption" color="error">
              作成に失敗しました。もう一度お試しください。
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>キャンセル</Button>
          <form.Subscribe selector={(state) => state.values.displayName}>
            {(displayName) => (
              <Button
                type="submit"
                variant="contained"
                disabled={!displayName.trim() || isPending}
              >
                追加
              </Button>
            )}
          </form.Subscribe>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
