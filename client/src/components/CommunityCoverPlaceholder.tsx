import type { ReactElement } from "react";
import { generateCommunityCoverPattern } from "@hatchery/common";

interface CommunityCoverPlaceholderProps {
  id: string;
  height?: number;
}

// SLACK_COLORS.blue (#1164A3) ベースの4段階濃淡パレット（デザインシステム準拠）
const BG_COLORS = ["#0A3A5E", "#0D4F82", "#1164A3", "#1A7AC8"] as const;
const FG_COLORS = ["#C5E4F5", "#D2EBF8", "#DFF1FA", "#E8F4FC"] as const;

/** パターン幅（density に反比例して密になる）。 */
function getPatternSize(density: number): number {
  return 48 / density;
}

/**
 * community id をシードにした決定的な幾何学パターンをカバー画像領域に SVG で描画する（#1021）。
 * coverUrl 未設定時のフォールバック用。外部サービスに依存しない。
 */
export function CommunityCoverPlaceholder({
  id,
  height = 160,
}: CommunityCoverPlaceholderProps): ReactElement {
  const { variant, shade, angleDeg, density } = generateCommunityCoverPattern({ id });
  const bgColor = BG_COLORS[shade];
  const fgColor = FG_COLORS[shade];
  const patternId = `cover-pattern-${id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const size = getPatternSize(density);
  const half = size / 2;

  const patternContent = (() => {
    switch (variant) {
      case 0:
        // ストライプ: 水平線
        return <line x1="0" y1={half} x2={size} y2={half} stroke={fgColor} strokeWidth="2" />;
      case 1:
        // ドット: 中心に円
        return <circle cx={half} cy={half} r={Math.max(size * 0.12, 2)} fill={fgColor} />;
      case 2:
        // 菱形: 頂点4点のポリゴン
        return (
          <polygon
            points={`${half},0 ${size},${half} ${half},${size} 0,${half}`}
            fill="none"
            stroke={fgColor}
            strokeWidth="1.5"
          />
        );
      case 3:
      default:
        // 交差線: 対角×
        return (
          <>
            <line x1="0" y1="0" x2={size} y2={size} stroke={fgColor} strokeWidth="1.5" />
            <line x1={size} y1="0" x2="0" y2={size} stroke={fgColor} strokeWidth="1.5" />
          </>
        );
    }
  })();

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 800 ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ display: "block" }}
      data-testid="community-cover-placeholder"
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angleDeg})`}
        >
          {patternContent}
        </pattern>
      </defs>
      <rect
        width="800"
        height={height}
        fill={bgColor}
        data-testid="cover-bg-rect"
      />
      <rect
        width="800"
        height={height}
        fill={`url(#${patternId})`}
        opacity="0.6"
        data-testid="cover-pattern-rect"
      />
    </svg>
  );
}
