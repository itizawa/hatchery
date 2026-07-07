import type { ReactElement } from "react";

import { COMMUNITY_WORKERS_MAX } from "@hatchery/common";
import type { Worker } from "@hatchery/common";
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
} from "./uiParts/index.js";

interface CommunityWorkersSelectProps {
  /** 選択肢となる全 Bot Worker。 */
  workers: readonly Worker[];
  /** 現在選択されている workerId 配列。 */
  value: string[];
  /** 選択変更時のコールバック（置換後の id 配列を渡す）。 */
  onChange: (workerIds: string[]) => void;
  /** 選択肢/現在値のロード中は disabled にする。 */
  disabled?: boolean;
  /** label 用 id（複数ダイアログでの衝突回避）。 */
  labelId: string;
}

/**
 * コミュニティの所属ワーカーを複数選択する Select（#1079）。
 * `WorkerCommunitiesSelect`（#490・ワーカー起点）の逆方向。状態は呼び出し元の
 * `@tanstack/react-form`（form.Field）が保持し、本コンポーネントは表示と変更通知のみ担う。
 * 選択上限は common の COMMUNITY_WORKERS_MAX（サーバ Zod と二重防御）。
 */
export function CommunityWorkersSelect({
  workers,
  value,
  onChange,
  disabled = false,
  labelId,
}: CommunityWorkersSelectProps): ReactElement {
  const nameById = new Map(workers.map((w) => [w.id, w.displayName]));

  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel id={labelId}>所属ワーカー</InputLabel>
      <Select
        labelId={labelId}
        label="所属ワーカー"
        multiple
        value={value}
        slotProps={{ input: { "aria-label": "所属ワーカー" } }}
        onChange={(e) => {
          const next = e.target.value;
          const ids = typeof next === "string" ? next.split(",") : (next as string[]);
          // 上限超過は無視（サーバ Zod とも二重で守る）。
          onChange(ids.slice(0, COMMUNITY_WORKERS_MAX));
        }}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(selected as string[]).map((id) => (
              <Chip key={id} size="small" label={nameById.get(id) ?? id} />
            ))}
          </Box>
        )}
      >
        {workers.map((w) => (
          <MenuItem key={w.id} value={w.id}>
            <Checkbox checked={value.includes(w.id)} size="small" />
            <ListItemText primary={w.displayName} secondary={w.role} />
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        このコミュニティに所属させるワーカーを選択します（最大 {COMMUNITY_WORKERS_MAX} 件）。
      </FormHelperText>
    </FormControl>
  );
}
