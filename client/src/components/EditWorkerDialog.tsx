import type { Worker } from "@hatchery/common";
import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_ROLE_MAX_LENGTH } from "@hatchery/common";
import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";
import { useState } from "react";

import { useUpdateWorker } from "../api/workers.js";
import { useCommunities } from "../api/communities.js";
import {
  useSetWorkerCommunities,
  useWorkerCommunities,
} from "../api/workerCommunities.js";
import { WorkerCommunitiesSelect } from "./WorkerCommunitiesSelect.js";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
} from "./uiParts/index.js";

const PERSONALITY_MAX_LENGTH = 500;

interface EditWorkerDialogProps {
  /** 編集対象のワーカー */
  worker: Worker;
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
}

/**
 * ワーカーの表示名・役割・性格・参加コミュニティを編集するダイアログ（#181 / #329 / #490）。
 * admin 管理画面から呼び出す。@tanstack/react-form を使いフォーム状態を管理する（CLAUDE.md フォーム規約）。
 * 各入力フィールドに inputProps.maxLength を設定し、サーバー側 Zod と二重防御する（CLAUDE.md バリデーションルール）。
 */
export function EditWorkerDialog({ worker, open, onClose }: EditWorkerDialogProps): ReactElement {
  const updateMutation = useUpdateWorker();
  const setCommunitiesMutation = useSetWorkerCommunities();
  const communitiesQuery = useCommunities();
  const workerCommunitiesQuery = useWorkerCommunities(worker.id);
  const [errorOpen, setErrorOpen] = useState(false);

  const communities = communitiesQuery.data ?? [];
  // 現在の参加コミュニティ取得が完了するまではフォームの初期値が確定しないため、
  // 取得完了後に form を再マウントする（defaultValues は非同期更新されないため key で制御）。
  // 取得が「進行中（isLoading）」の間だけ初期化中とみなす。エラー時は isLoading=false になり
  // フォーム編集を可能にする（取得失敗で名前・役割の編集まで永久にブロックしないため）。
  const initialCommunityIds = workerCommunitiesQuery.data;
  const isInitializing = workerCommunitiesQuery.isLoading;
  // 参加コミュニティ取得に成功した場合のみ、その編集と置換 API 呼び出しを行う。
  // 取得失敗時は communityIds を触らず（誤って全解除しないため）、エラー表示のみ行う。
  const canEditCommunities = workerCommunitiesQuery.isSuccess;

  const form = useForm({
    defaultValues: {
      displayName: worker.displayName,
      role: worker.role ?? "",
      personality: worker.personality ?? "",
      communityIds: initialCommunityIds ?? [],
    },
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({
          id: worker.id,
          body: {
            displayName: value.displayName || undefined,
            role: value.role || undefined,
            personality: value.personality || undefined,
          },
        });
        // 参加コミュニティの取得に成功している場合のみ置換する。
        // 取得失敗時に呼ぶと未取得の空配列で既存紐づきを誤って消すため呼ばない。
        if (canEditCommunities) {
          await setCommunitiesMutation.mutateAsync({
            workerId: worker.id,
            communityIds: value.communityIds,
          });
        }
        onClose();
      } catch {
        setErrorOpen(true);
      }
    },
  });

  const isPending = updateMutation.isPending || setCommunitiesMutation.isPending;

  return (
    <>
      <Dialog
        // 取得完了タイミングで初期値を反映するため form を再マウントする。
        key={isInitializing ? "loading" : "ready"}
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ワーカー編集</DialogTitle>
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
                    inputProps={{ "aria-label": "表示名", maxLength: WORKER_DISPLAY_NAME_MAX_LENGTH }}
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
                    inputProps={{ "aria-label": "役割", maxLength: WORKER_ROLE_MAX_LENGTH }}
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
                    inputProps={{ "aria-label": "性格", maxLength: PERSONALITY_MAX_LENGTH }}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    helperText={`${field.state.value.length}/${PERSONALITY_MAX_LENGTH}`}
                  />
                )}
              </form.Field>
              {isInitializing ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={16} />
                  参加コミュニティを読み込み中…
                </Box>
              ) : canEditCommunities ? (
                <form.Field name="communityIds">
                  {(field) => (
                    <WorkerCommunitiesSelect
                      labelId="edit-worker-communities-label"
                      communities={communities}
                      value={field.state.value}
                      onChange={(ids) => field.handleChange(ids)}
                      disabled={communitiesQuery.isLoading}
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
            <Button type="submit" variant="contained" disabled={isPending || isInitializing}>
              保存
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
      >
        <Alert severity="error" onClose={() => setErrorOpen(false)}>
          ワーカーの更新に失敗しました
        </Alert>
      </Snackbar>
    </>
  );
}
