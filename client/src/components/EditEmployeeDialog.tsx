import type { Employee } from "@hatchery/common";
import { EMPLOYEE_DISPLAY_NAME_MAX_LENGTH, EMPLOYEE_ROLE_MAX_LENGTH } from "@hatchery/common";
import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";
import { useState } from "react";

import { useUpdateEmployee } from "../api/employees.js";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
} from "./uiParts/index.js";

const PERSONALITY_MAX_LENGTH = 500;

interface EditEmployeeDialogProps {
  /** 編集対象のワーカー */
  employee: Employee;
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
}

/**
 * ワーカーの表示名・役割・性格を編集するダイアログ（#181）。
 * admin 管理画面から呼び出す。@tanstack/react-form を使いフォーム状態を管理する（CLAUDE.md フォーム規約）。
 * 各入力フィールドに inputProps.maxLength を設定し、サーバー側 Zod と二重防御する（CLAUDE.md バリデーションルール）。
 */
export function EditEmployeeDialog({ employee, open, onClose }: EditEmployeeDialogProps): ReactElement {
  const updateMutation = useUpdateEmployee();
  const [errorOpen, setErrorOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      displayName: employee.displayName,
      role: employee.role ?? "",
      personality: employee.personality ?? "",
    },
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({
          id: employee.id,
          body: {
            displayName: value.displayName || undefined,
            role: value.role || undefined,
            personality: value.personality || undefined,
          },
        });
        onClose();
      } catch {
        setErrorOpen(true);
      }
    },
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
                    id="edit-employee-display-name"
                    inputProps={{ "aria-label": "表示名", maxLength: EMPLOYEE_DISPLAY_NAME_MAX_LENGTH }}
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
                    id="edit-employee-role"
                    inputProps={{ "aria-label": "役割", maxLength: EMPLOYEE_ROLE_MAX_LENGTH }}
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
                    id="edit-employee-personality"
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
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={updateMutation.isPending}>
              キャンセル
            </Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
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
