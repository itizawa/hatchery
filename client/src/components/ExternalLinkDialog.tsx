import type { ReactElement } from "react";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from "./uiParts/index.js";

/** ダイアログ内の UI 文言定数（表示崩れを防ぐため一元管理）。 */
const TEXTS = {
  title: "外部サイトへのアクセス",
  cautionBody:
    "外部サイトのコンテンツは Hatchery の管理外であり、当サイトは内容について責任を負いません。個人情報の入力には十分ご注意ください。",
  destinationLabel: "アクセス先:",
  skipWarningLabel: "今後この警告を表示しない",
  cancelButton: "キャンセル",
  continueButton: "続行",
} as const;

export interface ExternalLinkDialogProps {
  /** ダイアログの開閉状態。 */
  open: boolean;
  /** 遷移先の URL。 */
  url: string;
  /** ダイアログを閉じるコールバック（「キャンセル」ボタン・背景クリック・Esc）。 */
  onClose: () => void;
  /** 「続行」を押したときのコールバック。 */
  onContinue: () => void;
  /** 「今後この警告を表示しない」チェックボックスの現在値。 */
  skipWarning: boolean;
  /** チェックボックスの変更コールバック。 */
  onSkipWarningChange: (value: boolean) => void;
}

/**
 * 外部リンクの確認モーダル（Issue #661）。
 *
 * 外部サイトへ遷移する前にユーザーに確認を求めるダイアログ。
 * - タイトル「外部サイトへのアクセス」
 * - 遷移先ホスト名（`wordBreak` で崩れ防止）
 * - 注意事項テキスト（外部の責任・個人情報の注意）
 * - 「今後この警告を表示しない」チェックボックス
 * - 「キャンセル」「続行」ボタン
 *
 * 開閉・URL 管理・localStorage 永続化は `useExternalLink` フックが担う。
 */
export function ExternalLinkDialog({
  open,
  url,
  onClose,
  onContinue,
  skipWarning,
  onSkipWarningChange,
}: ExternalLinkDialogProps): ReactElement {
  // 遷移先のホスト名を抽出（URL 解析失敗時はフル URL を表示）
  let displayHost: string;
  try {
    displayHost = new URL(url).host;
  } catch {
    displayHost = url;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="h2">{TEXTS.title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {TEXTS.destinationLabel}
            </Typography>
            <Typography
              variant="body1"
              sx={{ wordBreak: "break-all", fontWeight: 600 }}
            >
              {displayHost}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {TEXTS.cautionBody}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={skipWarning}
                onChange={(e) => onSkipWarningChange(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">{TEXTS.skipWarningLabel}</Typography>
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXTS.cancelButton}</Button>
        <Button variant="contained" onClick={onContinue}>
          {TEXTS.continueButton}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
