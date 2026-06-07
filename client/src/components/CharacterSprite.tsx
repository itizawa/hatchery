import Box from "@mui/material/Box";
import type { Employee } from "@hatchery/common";
import type { KeyboardEvent, ReactElement } from "react";

import type { Position } from "../utils/office.js";

type Props = {
  employee: Employee;
  position: Position;
  size: number;
  onClick: (el: HTMLElement) => void;
};

export const CharacterSprite = ({ employee, position, size, onClick }: Props): ReactElement => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e.currentTarget);
    }
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={employee.displayName}
      onClick={(e) => onClick(e.currentTarget)}
      onKeyDown={handleKeyDown}
      sx={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        cursor: "pointer",
        userSelect: "none",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
          borderRadius: 1,
        },
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Antenna */}
        <rect x="7" y="0" width="2" height="2" fill="#9B8FFF" />
        {/* Head */}
        <rect x="3" y="2" width="10" height="8" rx="1" fill="#7C6AFB" />
        {/* Left eye */}
        <rect x="5" y="4" width="2" height="2" fill="white" />
        <rect x="6" y="5" width="1" height="1" fill="#1a1a1a" />
        {/* Right eye */}
        <rect x="9" y="4" width="2" height="2" fill="white" />
        <rect x="10" y="5" width="1" height="1" fill="#1a1a1a" />
        {/* Neck */}
        <rect x="7" y="10" width="2" height="1" fill="#7C6AFB" />
        {/* Body */}
        <rect x="4" y="11" width="8" height="4" rx="1" fill="#5B50D0" />
        {/* Left arm */}
        <rect x="1" y="12" width="3" height="2" rx="1" fill="#7C6AFB" />
        {/* Right arm */}
        <rect x="12" y="12" width="3" height="2" rx="1" fill="#7C6AFB" />
        {/* Chest detail */}
        <rect x="6" y="12" width="4" height="2" fill="#9B8FFF" />
      </svg>
    </Box>
  );
};
