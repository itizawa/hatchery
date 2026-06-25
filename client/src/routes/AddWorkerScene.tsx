import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";
import { useCreateAdminWorker } from "../api/admin.js";
import { getApiErrorMessage } from "../api/errors.js";
import { useSetWorkerCommunities } from "../api/workerCommunities.js";
import { WorkerCommunitiesField } from "../components/WorkerCommunitiesField.js";
import { Alert, Box, Button, Snackbar, TextField, Typography } from "../components/uiParts/index.js";

/**
 * ワーカー作成ページ（/admin/workers/new）。#888
 * 表示名・役割・参加コミュニティを @tanstack/react-form で管理し、
 * 作成成功後に編集ページへ自動遷移する。
 */
export function AddWorkerScene(): ReactElement {
  const navigate = useNavigate();
  const createWorker = useCreateAdminWorker();
  const setCommunities = useSetWorkerCommunities();

  const saveError = createWorker.error ?? setCommunities.error;
  const isSaveError = createWorker.isError || setCommunities.isError;
  const handleErrorClose = (): void => {
    createWorker.reset();
    setCommunities.reset();
  };

  const form = useForm({
    defaultValues: {
      displayName: "",
      role: "",
      communityIds: [] as string[],
    },
    onSubmit: async ({ value }) => {
      try {
        const created = await createWorker.mutateAsync({
          displayName: value.displayName.trim(),
          role: value.role.trim() || undefined,
        });
        await setCommunities.mutateAsync({
          workerId: created.id,
          communityIds: value.communityIds,
        });
        await navigate({ to: "/admin/workers/$workerId/edit", params: { workerId: created.id } });
      } catch {
        // エラー表示は mutation の状態に委ねる
      }
    },
  });

  const isPending = createWorker.isPending || setCommunities.isPending;

  return (
    <Box sx={{ p: 3, maxWidth: 560 }}>
      <Box sx={{ mb: 3 }}>
        <Link to="/admin" search={{ tab: "workers" }}>
          ← 一覧に戻る
        </Link>
      </Box>
      <Typography variant="h5" component="h1" gutterBottom>
        ワーカーを追加
      </Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
      >
        <form.Field
          name="displayName"
          validators={{
            onSubmit: ({ value }) => (!value.trim() ? "表示名は必須です" : undefined),
          }}
        >
          {(field) => (
            <TextField
              label="表示名"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{ htmlInput: { "aria-label": "表示名", maxLength: WORKER_DISPLAY_NAME_MAX_LENGTH } }}
              error={field.state.meta.errors.length > 0}
              helperText={field.state.meta.errors[0] ?? ""}
              required
              fullWidth
              autoFocus
            />
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <TextField
              label="役割（任意）"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{ htmlInput: { "aria-label": "役割（任意）", maxLength: WORKER_ROLE_MAX_LENGTH } }}
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
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
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
        </Box>
      </Box>
      <Snackbar open={isSaveError} autoHideDuration={6000} onClose={handleErrorClose}>
        <Alert severity="error" onClose={handleErrorClose}>
          {getApiErrorMessage(saveError, "ワーカーの作成に失敗しました")}
        </Alert>
      </Snackbar>
    </Box>
  );
}
