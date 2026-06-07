import { Box, Chip, Popover, Typography, useMediaQuery } from "./uiParts";

import type { Employee } from "@hatchery/common";
import { useEffect, useState, type ReactElement } from "react";

import { CharacterSprite } from "./CharacterSprite.js";
import {
  type Direction,
  type Position,
  nextPosition,
  randomDirection,
  randomPosition,
} from "../utils/office.js";

const CHAR_SIZE = 48;
const OFFICE_BOUNDS = { width: 800, height: 500 };
const SPEED = 1.5;

type CharacterState = {
  employee: Employee;
  position: Position;
  direction: Direction;
};

type PopoverState = {
  element: HTMLElement;
  employee: Employee;
};

type Props = {
  employees: readonly Employee[];
};

export const OfficeView = ({ employees }: Props): ReactElement => {
  const [characters, setCharacters] = useState<CharacterState[]>(() =>
    employees.map((employee) => ({
      employee,
      position: randomPosition(OFFICE_BOUNDS, CHAR_SIZE),
      direction: randomDirection(),
    })),
  );

  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);

  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (prefersReducedMotion) return;

    let animId: number;
    const animate = () => {
      setCharacters((prev) =>
        prev.map((char) => {
          const { position, direction } = nextPosition(
            char.position,
            char.direction,
            SPEED,
            OFFICE_BOUNDS,
            CHAR_SIZE,
          );
          return { ...char, position, direction };
        }),
      );
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  const handleCharacterClick = (el: HTMLElement, employee: Employee) => {
    setPopoverState({ element: el, employee });
  };

  return (
    <Box
      aria-label="仮想オフィス"
      sx={{
        position: "relative",
        width: OFFICE_BOUNDS.width,
        height: OFFICE_BOUNDS.height,
        bgcolor: "#F5F5F0",
        border: "2px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      {characters.map((char) => (
        <CharacterSprite
          key={char.employee.id}
          employee={char.employee}
          position={char.position}
          size={CHAR_SIZE}
          onClick={(el) => handleCharacterClick(el, char.employee)}
        />
      ))}
      <Popover
        open={popoverState !== null}
        anchorEl={popoverState?.element ?? null}
        onClose={() => setPopoverState(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {popoverState && (
          <Box sx={{ p: 2, maxWidth: 240, minWidth: 160 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {popoverState.employee.displayName}
            </Typography>
            {popoverState.employee.role && (
              <Typography variant="body2" color="text.secondary">
                {popoverState.employee.role}
              </Typography>
            )}
            {popoverState.employee.isBot && (
              <Chip label="AI社員" size="small" color="primary" sx={{ mt: 1 }} />
            )}
            {popoverState.employee.personality && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {popoverState.employee.personality}
              </Typography>
            )}
          </Box>
        )}
      </Popover>
    </Box>
  );
};
