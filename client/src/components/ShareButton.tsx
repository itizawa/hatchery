import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import XIcon from "@mui/icons-material/X";
import { useState, type ReactElement } from "react";

import { Alert, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Tooltip } from "./uiParts";

interface ShareButtonProps {
  /** 共有対象の URL（コミュニティ詳細ページの URL）。 */
  shareUrl: string;
  /** 共有時のタイトル（コミュニティ名）。X のシェアテキストに含める。 */
  shareTitle: string;
}

/**
 * X(Twitter) の intent URL を生成する純粋関数。
 * `text`（タイトルを含むシェア文言）と `url` を encodeURIComponent でエスケープして付与する。
 */
export function buildXShareUrl(shareTitle: string, shareUrl: string): string {
  const text = `${shareTitle} | Hatchery`;
  const params = new URLSearchParams({ text, url: shareUrl });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * SNS 共有ボタン（#257）。
 * コミュニティ詳細画面のヘッダーに置き、URL コピー / X シェアの導線を提供する。
 * 認証状態に関わらず表示される（シェアは誰でも可能）。
 */
export const ShareButton = ({ shareUrl, shareTitle }: ShareButtonProps): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const open = anchorEl !== null;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = async () => {
    handleClose();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSnackbarOpen(true);
    } catch {
      // クリップボード API が使えない環境では何もしない（フィードバックは出さない）。
    }
  };

  return (
    <>
      <Tooltip title="共有">
        <IconButton aria-label="共有" size="small" onClick={handleOpen}>
          <ShareIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>URL をコピー</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href={buildXShareUrl(shareTitle, shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          <ListItemIcon>
            <XIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>X でシェア</ListItemText>
        </MenuItem>
      </Menu>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          URL をコピーしました
        </Alert>
      </Snackbar>
    </>
  );
};
