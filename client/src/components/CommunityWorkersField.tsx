import type { ReactElement } from "react";

import { useBotWorkers } from "../api/workers.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { CommunityWorkersSelect } from "./CommunityWorkersSelect.js";
import { Alert, FormControl, InputLabel, Select } from "./uiParts/index.js";

interface CommunityWorkersFieldProps {
  /** 現在選択されている workerId 配列。 */
  value: string[];
  /** 選択変更時のコールバック（置換後の id 配列を渡す）。 */
  onChange: (workerIds: string[]) => void;
  /** label 用 id（複数ダイアログでの衝突回避）。 */
  labelId: string;
}

/**
 * 全 Bot Worker（useBotWorkers）を取得して CommunityWorkersSelect を描画する内部コンポーネント。
 * #462: useBotWorkers は Suspense 化しているため、本コンポーネントを QueryBoundary で包む
 * （ローディング=無効化された Select、取得失敗=注意アラート）。
 */
const CommunityWorkersFieldInner = ({
  value,
  onChange,
  labelId,
}: CommunityWorkersFieldProps): ReactElement => {
  const { data: workers } = useBotWorkers();
  return (
    <CommunityWorkersSelect labelId={labelId} workers={workers} value={value} onChange={onChange} />
  );
};

/** ワーカー取得中の Select プレースホルダ（無効化された空 Select）。 */
const CommunityWorkersFieldFallback = ({ labelId }: { labelId: string }): ReactElement => (
  <FormControl fullWidth size="small" disabled>
    <InputLabel id={labelId}>所属ワーカー</InputLabel>
    <Select labelId={labelId} label="所属ワーカー" multiple value={[]} />
  </FormControl>
);

/**
 * コミュニティの所属ワーカー選択フィールド（#1079）。`WorkerCommunitiesField.tsx`（#490 / #462）の逆方向。
 * 全 Bot Worker 取得（useBotWorkers・Suspense）を局所 QueryBoundary に閉じ込め、
 * 取得中は無効化 Select、取得失敗は注意アラートを表示する。状態は呼び出し元の form.Field が保持する。
 */
export const CommunityWorkersField = ({
  value,
  onChange,
  labelId,
}: CommunityWorkersFieldProps): ReactElement => (
  <QueryBoundary
    fallback={<CommunityWorkersFieldFallback labelId={labelId} />}
    errorFallback={() => (
      <Alert severity="warning">
        所属ワーカーの選択肢の読み込みに失敗しました。ワーカーの選択はできません。
      </Alert>
    )}
  >
    <CommunityWorkersFieldInner value={value} onChange={onChange} labelId={labelId} />
  </QueryBoundary>
);
