import type { ReactElement } from "react";

import { Alert, Snackbar } from "./uiParts";

/**
 * `useSavedFlagSnackbar`（#1080 / #1081）が返す open/close を表示する共通 Snackbar。
 * AdminWorkerTable・CommunitiesTab で見た目が重複していたため切り出した。
 */
export function SavedFlagSnackbar({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}): ReactElement {
  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="success" onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  );
}
