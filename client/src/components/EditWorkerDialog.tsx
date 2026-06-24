import type { Worker, WorkerVerbosity } from "@hatchery/common";
import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_PERSONALITY_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";
import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";

import { useUpdateWorker } from "../api/workers.js";
import { getApiErrorMessage } from "../api/errors.js";
import {
  useSetWorkerCommunities,
  useWorkerCommunities,
} from "../api/workerCommunities.js";
import { WorkerCommunitiesField } from "./WorkerCommunitiesField.js";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
} from "./uiParts/index.js";

/** 文章量の選択肢（#625）。 */
const VERBOSITY_OPTIONS: { value: WorkerVerbosity; label: string }[] = [
  { value: "concise", label: "簡潔" },
  { value: "standard", label: "標準" },
  { value: "detailed", label: "詳細" },
];

interface EditWorkerDialogProps {
  /** 編集対象のワーカー */
  worker: Worker;
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
}

type FormValues = {
  displayName: string;
  role: string;
  personality: string;
  verbosity: WorkerVerbosity;
  communityIds: string[];
};

interface EditWorkerFormContentProps {
  worker: Worker;
  initialCommunityIds: string[];
  canEditCommunities: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: FormValues) => Promise<void>;
}

/**
 * useForm を含む form 部分。isInitializing が false になってからマウントされるため、
 * defaultValues.communityIds が初期値として確定した状態で useForm が初期化される（#832）。
 */
function EditWorkerFormContent({
  worker,
  initialCommunityIds,
  canEditCommunities,
  isPending,
  onClose,
  onSubmit,
}: EditWorkerFormContentProps): ReactElement {
  const form = useForm({
    defaultValues: {
      displayName: worker.displayName,
      role: worker.role ?? "",
      personality: worker.personality ?? "",
      verbosity: (worker.verbosity as WorkerVerbosity | undefined) ?? "standard",
      communityIds: initialCommunityIds,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
      }}
    >
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <form.Field name="displayName">
            {(field) => (
              <TextField
                label="表示名"
                id="edit-worker-display-name"
                slotProps={{ htmlInput: { "aria-label": "表示名", maxLength: WORKER_DISPLAY_NAME_MAX_LENGTH } }}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
                fullWidth
                size="small"
              />
            )}
          </form.Field>
          <form.Field name="role">
            {(field) => (
              <TextField
                label="役割"
                id="edit-worker-role"
                slotProps={{ htmlInput: { "aria-label": "役割", maxLength: WORKER_ROLE_MAX_LENGTH } }}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                fullWidth
                size="small"
              />
            )}
          </form.Field>
          <form.Field name="personality">
            {(field) => (
              <TextField
                label="性格"
                id="edit-worker-personality"
                slotProps={{ htmlInput: { "aria-label": "性格", maxLength: WORKER_PERSONALITY_MAX_LENGTH } }}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                fullWidth
                multiline
                rows={3}
                size="small"
                helperText={`${field.state.value.length}/${WORKER_PERSONALITY_MAX_LENGTH}`}
              />
            )}
          </form.Field>
          <form.Field name="verbosity">
            {(field) => (
              <FormControl fullWidth size="small">
                <InputLabel id="edit-worker-verbosity-label">文章量</InputLabel>
                <Select
                  labelId="edit-worker-verbosity-label"
                  id="edit-worker-verbosity"
                  label="文章量"
                  slotProps={{ input: { "aria-label": "文章量" } }}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as WorkerVerbosity)}
                  onBlur={field.handleBlur}
                >
                  {VERBOSITY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </form.Field>
          {canEditCommunities ? (
            <form.Field name="communityIds">
              {(field) => (
                <WorkerCommunitiesField
                  labelId="edit-worker-communities-label"
                  value={field.state.value}
                  onChange={(ids) => field.handleChange(ids)}
                />
              )}
            </form.Field>
          ) : (
            <Alert severity="warning">
              参加コミュニティの読み込みに失敗しました。表示名・役割・性格のみ編集できます。
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          キャンセル
        </Button>
        <Button type="submit" variant="contained" disabled={isPending}>
          保存
        </Button>
      </DialogActions>
    </Box>
  );
}

/**
 * ワーカーの表示名・役割・性格・参加コミュニティを編集するダイアログ（#181 / #329 / #490）。
 * admin 管理画面から呼び出す。@tanstack/react-form を使いフォーム状態を管理する（CLAUDE.md フォーム規約）。
 * 参加コミュニティ取得完了後に EditWorkerFormContent をマウントすることで Dialog の再マウントを防ぐ（#832）。
 */
export function EditWorkerDialog({ worker, open, onClose }: EditWorkerDialogProps): ReactElement {
  const updateMutation = useUpdateWorker();
  const setCommunitiesMutation = useSetWorkerCommunities();
  const workerCommunitiesQuery = useWorkerCommunities(worker.id);

  // 保存エラーは mutation の isError / error に集約し、独立ローカル state を持たない（#476）。
  const saveError = updateMutation.error ?? setCommunitiesMutation.error;
  const isSaveError = updateMutation.isError || setCommunitiesMutation.isError;
  const handleErrorClose = (): void => {
    updateMutation.reset();
    setCommunitiesMutation.reset();
  };

  const initialCommunityIds = workerCommunitiesQuery.data ?? [];
  // isLoading の間だけ初期化中とみなす。エラー時は isLoading=false になり編集を可能にする。
  const isInitializing = workerCommunitiesQuery.isLoading;
  // 取得成功時のみ communityIds 編集と置換 API 呼び出しを行う（誤って全解除しないため）。
  const canEditCommunities = workerCommunitiesQuery.isSuccess;
  const isPending = updateMutation.isPending || setCommunitiesMutation.isPending;

  const handleSubmit = async (value: FormValues): Promise<void> => {
    try {
      await updateMutation.mutateAsync({
        id: worker.id,
        body: {
          displayName: value.displayName || undefined,
          role: value.role || undefined,
          personality: value.personality || undefined,
          verbosity: value.verbosity,
        },
      });
      // 参加コミュニティの取得に成功している場合のみ置換する。
      if (canEditCommunities) {
        await setCommunitiesMutation.mutateAsync({
          workerId: worker.id,
          communityIds: value.communityIds,
        });
      }
      onClose();
    } catch {
      // エラー表示は updateMutation / setCommunitiesMutation の状態に委ねる（#476）。
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>ワーカー編集</DialogTitle>
        {isInitializing ? (
          <>
            <DialogContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} />
                参加コミュニティを読み込み中…
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>キャンセル</Button>
            </DialogActions>
          </>
        ) : (
          <EditWorkerFormContent
            worker={worker}
            initialCommunityIds={initialCommunityIds}
            canEditCommunities={canEditCommunities}
            isPending={isPending}
            onClose={onClose}
            onSubmit={handleSubmit}
          />
        )}
      </Dialog>
      <Snackbar
        open={isSaveError}
        autoHideDuration={6000}
        onClose={handleErrorClose}
      >
        <Alert severity="error" onClose={handleErrorClose}>
          {getApiErrorMessage(saveError, "ワーカーの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </>
  );
}
