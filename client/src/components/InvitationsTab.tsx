import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "./uiParts";

import type { ReactElement } from "react";
import { useState } from "react";

import type { Invitation, InvitationStatus } from "@hatchery/common";
import { useCreateInvitation, useInvitations, useRevokeInvitation } from "../api/invitations.js";

const EXPIRY_PRESETS = [
  { label: "1時間", value: 1 },
  { label: "24時間", value: 24 },
  { label: "7日間", value: 24 * 7 },
  { label: "30日間", value: 24 * 30 },
] as const;

type ChipColor = "success" | "default" | "warning" | "error";

const STATUS_CONFIG: Record<InvitationStatus, { label: string; color: ChipColor }> = {
  active: { label: "有効", color: "success" },
  used: { label: "使用済み", color: "default" },
  expired: { label: "期限切れ", color: "warning" },
  revoked: { label: "失効済み", color: "error" },
};

function buildInviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

interface InvitationRowProps {
  invitation: Invitation;
  onCopied: () => void;
}

function InvitationRow({ invitation, onCopied }: InvitationRowProps): ReactElement {
  const revoke = useRevokeInvitation();
  const { label, color } = STATUS_CONFIG[invitation.status];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(invitation.token));
      onCopied();
    } catch {
      // clipboard unavailable; fail silently
    }
  };

  const handleRevoke = async () => {
    try {
      await revoke.mutateAsync(invitation.id);
    } catch {
      // error state is tracked via revoke.isError
    }
  };

  return (
    <TableRow>
      <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {invitation.memo ?? "-"}
      </TableCell>
      <TableCell>{invitation.expiresAt.toLocaleString("ja-JP")}</TableCell>
      <TableCell>
        <Chip label={label} color={color} size="small" />
      </TableCell>
      <TableCell>
        <Button size="small" variant="outlined" onClick={handleCopy} aria-label="URL コピー">
          URL コピー
        </Button>
      </TableCell>
      <TableCell>
        <Button
          size="small"
          color="error"
          variant="outlined"
          disabled={invitation.status !== "active" || revoke.isPending}
          onClick={handleRevoke}
        >
          失効
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function InvitationsTab(): ReactElement {
  const { data: invitations = [], isLoading } = useInvitations();
  const createMutation = useCreateInvitation();

  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [memo, setMemo] = useState("");
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [createErrorOpen, setCreateErrorOpen] = useState(false);

  const handleCreate = async () => {
    try {
      const result = await createMutation.mutateAsync({
        expiresInHours,
        ...(memo.trim() ? { memo: memo.trim() } : {}),
      });
      setCreatedInvitation(result);
      setMemo("");
    } catch {
      setCreateErrorOpen(true);
    }
  };

  const handleCopyCreated = async () => {
    if (!createdInvitation) return;
    try {
      await navigator.clipboard.writeText(buildInviteUrl(createdInvitation.token));
      setSnackbarOpen(true);
    } catch {
      // clipboard unavailable; fail silently
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          招待リンクを発行
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="expiry-label">有効期限</InputLabel>
            <Select
              labelId="expiry-label"
              label="有効期限"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
            >
              {EXPIRY_PRESETS.map((preset) => (
                <MenuItem key={preset.value} value={preset.value}>
                  {preset.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="メモ（任意）"
            size="small"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            inputProps={{ maxLength: 200 }}
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            発行
          </Button>
        </Box>

        {createdInvitation && (
          <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: "break-all" }}>
              {buildInviteUrl(createdInvitation.token)}
            </Typography>
            <Button size="small" variant="outlined" onClick={handleCopyCreated}>
              コピー
            </Button>
          </Box>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          招待一覧
        </Typography>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">
            読み込み中...
          </Typography>
        ) : invitations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            招待がありません。
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>メモ</TableCell>
                <TableCell>有効期限</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitations.map((inv) => (
                <InvitationRow key={inv.id} invitation={inv} onCopied={() => setSnackbarOpen(true)} />
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          招待 URL をコピーしました
        </Alert>
      </Snackbar>
      <Snackbar
        open={createErrorOpen}
        autoHideDuration={4000}
        onClose={() => setCreateErrorOpen(false)}
      >
        <Alert severity="error" onClose={() => setCreateErrorOpen(false)}>
          招待リンクの発行に失敗しました
        </Alert>
      </Snackbar>
    </Box>
  );
}
