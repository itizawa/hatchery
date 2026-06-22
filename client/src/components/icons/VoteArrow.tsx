import { SvgIcon } from "../uiParts";
import type { ReactElement } from "react";

interface VoteArrowProps {
  direction: "up" | "down";
  variant: "solid" | "outline";
  fontSize?: "small" | "medium" | "large" | "inherit";
}

export const VoteArrow = ({ direction, variant, fontSize = "small" }: VoteArrowProps): ReactElement => {
  const testId = `vote-arrow-${direction}-${variant}`;

  if (direction === "up") {
    return (
      <SvgIcon data-testid={testId} fontSize={fontSize} viewBox="0 0 24 24">
        {variant === "solid" ? (
          <polygon points="12,5 3,17 21,17" fill="currentColor" />
        ) : (
          <polyline
            points="3,17 12,5 21,17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </SvgIcon>
    );
  }

  return (
    <SvgIcon data-testid={testId} fontSize={fontSize} viewBox="0 0 24 24">
      {variant === "solid" ? (
        <polygon points="12,19 3,7 21,7" fill="currentColor" />
      ) : (
        <polyline
          points="3,7 12,19 21,7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </SvgIcon>
  );
};
