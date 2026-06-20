import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import XIcon from "@mui/icons-material/X";
import { useState, type ReactElement } from "react";

import { useExternalLink } from "../hooks/useExternalLink.js";
import { Alert, Chip, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar } from "./uiParts";

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
export function buildXShareUrl({ shareTitle, shareUrl }: { shareTitle: string; shareUrl: string }): string {
  const text = `${shareTitle} | Hatchery`;
  const params = new URLSearchParams({ text, url: shareUrl });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * SNS 共有ボタン（#257 / #747）。
 * Chip（pill 型ボタン）でトリガーし、クリックで既存のメニューを展開する。
 */
type CopyFeedback = { open: boolean; severity: "success" | "error" };

export const ShareButton = ({ shareUrl, shareTitle }: ShareButtonProps): ReactElement => {
  const { openExternalLink } = useExternalLink();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [feedback, setFeedback] = useState<CopyFeedback>({ open: false, severity: "success" });
  const open = anchorEl !== null;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const closeFeedback = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
  };

  const handleCopy = async () => {
    handleClose();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback({ open: true, severity: "success" });
    } catch {
      // 非セキュアコンテキスト（HTTP）や権限拒否で clipboard API が使えない場合。
      // silent にせず失敗を明示し、手動コピー用に URL を併記する。
      setFeedback({ open: true, severity: "error" });
    }
  };

  return (
    <>
      <Chip
        clickable
        icon={<ShareIcon />}
        label="共有"
        aria-label="共有"
        size="small"
        onClick={handleOpen}
        variant="outlined"
        sx={{ height: 32,padding:"0px 8px", bgcolor: "background.paper", border:"none" }}
      />
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>URL をコピー</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            openExternalLink(buildXShareUrl({ shareTitle, shareUrl }));
          }}
        >
          <ListItemIcon>
            <XIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>X でシェア</ListItemText>
        </MenuItem>
      </Menu>
      <Snackbar
        open={feedback.open}
        autoHideDuration={feedback.severity === "error" ? 6000 : 2000}
        onClose={closeFeedback}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {feedback.severity === "success" ? (
          <Alert severity="success" onClose={closeFeedback}>
            URL をコピーしました
          </Alert>
        ) : (
          <Alert severity="error" onClose={closeFeedback}>
            <span>URL のコピーに失敗しました</span>
            <br />
            手動でコピーしてください: {shareUrl}
          </Alert>
        )}
      </Snackbar>
    </>
  );
};
