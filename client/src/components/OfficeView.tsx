import { Box, Chip, Popover, Typography, useMediaQuery } from "./uiParts";

import type { Employee } from "@hatchery/common";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { CharacterSprite } from "./CharacterSprite.js";
import {
  type Bounds,
  type Direction,
  type Position,
  OFFICE_MAX_BOUNDS,
  clampPosition,
  nextPosition,
  officeBounds,
  randomDirection,
  randomPosition,
} from "../utils/office.js";

const CHAR_SIZE = 48;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  // コンテナ実幅から算出した動的 bounds。測定前は {0,0}。
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 });
  // bounds が確定するまでキャラクター初期化を遅延し、領域外配置を防ぐ。
  const [characters, setCharacters] = useState<CharacterState[]>([]);

  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);

  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // コンテナ実幅を ResizeObserver で測定し、動的 bounds に反映する。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (width: number) => {
      // 実幅が測定できない（jsdom 等でレイアウト 0）の場合は上限幅にフォールバックし、
      // キャラクターが描画されない事態を避ける。実測されたら追従する。
      const effectiveWidth = width > 0 ? width : OFFICE_MAX_BOUNDS.width;
      setBounds((prev) => {
        const next = officeBounds(effectiveWidth);
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };

    update(el.clientWidth);

    // ResizeObserver があればコンテナ実幅の変化に追従する。
    // 未対応環境（テスト用 jsdom 等）では window resize で実幅を再測定する。
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          update(entry.contentRect.width);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    const onResize = () => update(el.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // employees / bounds の変化に応じてキャラクター集合を同期する。
  // - 新規 employee は bounds 内のランダム位置で初期化。
  // - 既存 employee は座標を維持しつつ bounds 変化時に clampPosition で収める。
  useEffect(() => {
    if (bounds.width <= 0 || bounds.height <= 0) return;

    setCharacters((prev) => {
      const byId = new Map(prev.map((c) => [c.employee.id, c]));
      return employees.map((employee) => {
        const existing = byId.get(employee.id);
        if (existing) {
          return {
            ...existing,
            employee,
            position: clampPosition(existing.position, bounds, CHAR_SIZE),
          };
        }
        return {
          employee,
          position: randomPosition(bounds, CHAR_SIZE),
          direction: randomDirection(),
        };
      });
    });
  }, [employees, bounds]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (bounds.width <= 0 || bounds.height <= 0) return;

    let animId: number;
    const animate = () => {
      setCharacters((prev) =>
        prev.map((char) => {
          const { position, direction } = nextPosition(
            char.position,
            char.direction,
            SPEED,
            bounds,
            CHAR_SIZE,
          );
          return { ...char, position, direction };
        }),
      );
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion, bounds]);

  const handleCharacterClick = (el: HTMLElement, employee: Employee) => {
    setPopoverState({ element: el, employee });
  };

  return (
    <Box
      ref={containerRef}
      aria-label="仮想オフィス"
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: OFFICE_MAX_BOUNDS.width,
        aspectRatio: `${OFFICE_MAX_BOUNDS.width} / ${OFFICE_MAX_BOUNDS.height}`,
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
