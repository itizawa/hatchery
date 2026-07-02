import { useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import GetAppRounded from "@mui/icons-material/GetAppRounded";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from "./uiParts";

import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

export function InstallSnackbar() {
  const { shouldShowSnackbar, isIOS, dismissSnackbar, promptInstall } = useInstallPrompt();
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  const handleInstall = () => {
    if (isIOS) {
      setIosDialogOpen(true);
    } else {
      void promptInstall();
    }
  };

  return (
    <>
      {shouldShowSnackbar && (
        <Snackbar open anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
          <Alert
            icon={<GetAppRounded fontSize="small" />}
            severity="info"
            action={
              <>
                <Button size="small" onClick={handleInstall} sx={{ mr: 0.5 }}>
                  追加する
                </Button>
                <IconButton size="small" aria-label="閉じる" onClick={dismissSnackbar}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </>
            }
          >
            ホーム画面に追加してすばやく起動
          </Alert>
        </Snackbar>
      )}

      <Dialog open={iosDialogOpen} onClose={() => setIosDialogOpen(false)}>
        <DialogTitle>ホーム画面への追加方法</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <IosShareRounded fontSize="small" color="primary" />
              <Typography variant="body2">
                Safari 下部の共有ボタン（↑）をタップします。
              </Typography>
            </Stack>
            <Typography variant="body2">
              「ホーム画面に追加」を選択して「追加」をタップしてください。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosDialogOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
