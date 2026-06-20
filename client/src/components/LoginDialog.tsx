import type { ReactElement } from "react";

import { googleLoginUrl } from "../api/auth.js";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from "./uiParts/index.js";

export interface LoginDialogProps {
  /** ダイアログの開閉状態。 */
  open: boolean;
  /** ダイアログを閉じるコールバック（背景クリック・閉じるボタン）。 */
  onClose: () => void;
}

/**
 * ログインモーダル（#454）。
 *
 * ページ遷移せず、背景の閲覧コンテキストを保ったままログインできるよう、ログイン UI を
 * MUI `Dialog` 内に表示する。ログインは Google 認証のみ（#455）で入力フィールドを持たないため、
 * フォーム状態管理（`@tanstack/react-form`）やユーザー入力フィールドの `.max()` 制約は不要。
 *
 * 開閉状態は呼び出し側が URL の search param（`?login=1`）駆動で制御する
 * （新しいグローバル状態管理ライブラリを導入しない / CLAUDE.md）。
 */
export function LoginDialog({ open, onClose }: LoginDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle component="h2">ログイン</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Google アカウントでログインしてください。
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              window.location.href = googleLoginUrl();
            }}
          >
            Google でログイン
          </Button>
          {/* ログイン＝規約同意とみなす旨を明示する。リンクは別タブで開き、進行中のログイン導線を保つ。 */}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            ログインすることで、
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              利用規約
            </Link>
            および
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              プライバシーポリシー
            </Link>
            に同意したものとみなします。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
