import { Button } from "./uiParts";
import type { ReactElement } from "react";

interface SubscribeButtonProps {
  subscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  disabled?: boolean;
}

/**
 * コミュニティ購読/購読解除ボタン（ADR-0020）。
 * ユーザーは community を購読してホームフィードに反映できる。
 */
export const SubscribeButton = ({
  subscribed,
  onSubscribe,
  onUnsubscribe,
  disabled = false,
}: SubscribeButtonProps): ReactElement => {
  if (subscribed) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={onUnsubscribe}
        disabled={disabled}
      >
        購読解除
      </Button>
    );
  }

  return (
    <Button
      variant="contained"
      size="small"
      onClick={onSubscribe}
      disabled={disabled}
    >
      購読する
    </Button>
  );
};
