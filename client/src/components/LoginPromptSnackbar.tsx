import { Alert, Button, Snackbar } from "./uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

interface LoginPromptSnackbarProps {
  /** 表示状態。 */
  open: boolean;
  /** 閉じる操作（autoHide / クローズボタン）で呼ばれる。 */
  onClose: () => void;
}

/**
 * ゲスト（未認証）が vote を押したときに表示するログイン誘導スナックバー（#481）。
 * 「投票するにはログインが必要です」と伝え、/login へのログインリンクを提供する。
 * vote ボタン自体は活性のまま押せるため、サイレント 401 ではなく明示フィードバック + 導線になる。
 * ログインのモーダル化（#454）が入ったら、この遷移先をモーダルオープンへ差し替えればよい。
 */
export const LoginPromptSnackbar = ({ open, onClose }: LoginPromptSnackbarProps): ReactElement => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity="info"
        onClose={onClose}
        action={
          <Button color="inherit" size="small" component={RouterLink} to="/login">
            ログイン
          </Button>
        }
      >
        投票するにはログインが必要です
      </Alert>
    </Snackbar>
  );
};
