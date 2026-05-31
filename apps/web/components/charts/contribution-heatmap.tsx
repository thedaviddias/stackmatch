"use client";

import {
  CHART_HEATMAP_CELL_GAP,
  CHART_HEATMAP_CELL_SIZE,
  CHART_HEATMAP_LABEL_LEFT,
  CHART_HEATMAP_LABEL_TOP,
  CHART_HEATMAP_MAX_WEEKS,
  CHART_HEATMAP_MIN_WEEKS,
  CHART_HEATMAP_ROWS,
  HEATMAP_COLOR_LEVELS,
  HEATMAP_COLORS_AI,
  HEATMAP_COLORS_AUTOMATION,
  HEATMAP_COLORS_HUMAN,
  HEATMAP_MAX_COLOR_INDEX,
} from "@stackmatch/constants/og";
import { DAY_MS } from "@stackmatch/constants/time";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface DailyDataPoint {
  date: number; // epoch ms, midnight UTC
  human: number;
  ai: number;
  automation?: number;
  humanAdditions: number;
  aiAdditions: number;
  automationAdditions?: number;
}

interface ContributionHeatmapProps {
  data: DailyDataPoint[];
  viewMode: "commits" | "loc";
  todayMs?: number;
  /** When true, a sync is in progress and data may be incomplete */
  isSyncing?: boolean;
  /** When true, merged data includes private repos (which lack LOC data) */
  includesPrivateData?: boolean;
}

// Layout constants
const CELL_SIZE = CHART_HEATMAP_CELL_SIZE;
const CELL_GAP = CHART_HEATMAP_CELL_GAP;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const ROWS = CHART_HEATMAP_ROWS;
const LABEL_LEFT = CHART_HEATMAP_LABEL_LEFT;
const LABEL_TOP = CHART_HEATMAP_LABEL_TOP;
const MAX_WEEKS = CHART_HEATMAP_MAX_WEEKS;
const MIN_WEEKS = CHART_HEATMAP_MIN_WEEKS;

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""] as const;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Simplified square color: purely discrete levels based on activity.
 * Picks color family by dominant type (human / AI / automation).
 */
function getSquareColor(
  human: number,
  ai: number,
  automation: number,
  maxActivity: number
): string | null {
  const total = human + ai + automation;
  if (total === 0) return null;

  // Pick color family by dominant type
  let colorScale: readonly string[] = HEATMAP_COLORS_HUMAN;
  if (ai >= human && ai >= automation) {
    colorScale = HEATMAP_COLORS_AI;
  } else if (automation >= human && automation >= ai) {
    colorScale = HEATMAP_COLORS_AUTOMATION;
  }

  // Discrete indexing (0-4) based on activity level
  const index = Math.min(
    HEATMAP_MAX_COLOR_INDEX,
    Math.floor((total / maxActivity) * HEATMAP_COLOR_LEVELS)
  );
  return colorScale[index] ?? colorScale[0] ?? "#000";
}

/**
 * Calculate how many week columns fit in the available container width.
 * Returns a value clamped between MIN_WEEKS and MAX_WEEKS.
 */
function calcVisibleWeeks(containerWidth: number): number {
  if (containerWidth <= 0) return MAX_WEEKS;
  const available = containerWidth - LABEL_LEFT;
  const weeks = Math.floor(available / CELL_STEP);
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));
}

/**
 * Build a grid of N weeks ending on today.
 * Returns an array of { col, row, date, data? } entries.
 */
function buildGrid(dataMap: Map<number, DailyDataPoint>, weeksShown: number, todayMs = Date.now()) {
  const today = new Date(todayMs);
  today.setUTCHours(0, 0, 0, 0);

  // End on today's day-of-week position (GitHub convention)
  const todayDow = (today.getUTCDay() + 6) % 7; // Mon=0, Sun=6

  // Total cells: weeksShown full weeks + partial current week
  const totalDays = weeksShown * 7 + todayDow + 1;
  const startDate = new Date(today.getTime() - (totalDays - 1) * DAY_MS);

  const cells: Array<{
    col: number;
    row: number;
    date: Date;
    dateMs: number;
    data: DailyDataPoint | undefined;
  }> = [];

  for (let i = 0; i < totalDays; i++) {
    const cellDate = new Date(startDate.getTime() + i * DAY_MS);
    const dow = (cellDate.getUTCDay() + 6) % 7; // Mon=0
    const col = Math.floor(i / 7);
    const dateMs = cellDate.getTime();

    cells.push({
      col,
      row: dow,
      date: cellDate,
      dateMs,
      data: dataMap.get(dateMs),
    });
  }

  return cells;
}

/**
 * Compute month label positions for the top axis.
 * Returns { label, col } pairs for the first Monday of each new month.
 */
function buildMonthLabels(
  cells: Array<{ col: number; row: number; date: Date }>
): Array<{ label: string; col: number }> {
  const labels: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;

  for (const cell of cells) {
    if (cell.row !== 0) continue; // only look at Monday rows
    const month = cell.date.getUTCMonth();
    if (month !== lastMonth) {
      labels.push({ label: MONTH_NAMES[month] ?? "", col: cell.col });
      lastMonth = month;
    }
  }

  return labels;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface TooltipInfo {
  x: number;
  y: number;
  dateLabel: string;
  human: number;
  ai: number;
  automation: number;
  total: number;
  aiPercentage: string;
}

export function ContributionHeatmap({
  data,
  viewMode,
  todayMs,
  isSyncing,
  includesPrivateData,
}: ContributionHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Measure container width with ResizeObserver for responsive layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    setContainerWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // How many weeks fit in the current container width
  const visibleWeeks = useMemo(() => calcVisibleWeeks(containerWidth), [containerWidth]);

  // Build lookup map: date (epoch ms) -> data point
  const dataMap = useMemo(() => {
    const map = new Map<number, DailyDataPoint>();
    for (const point of data) {
      map.set(point.date, point);
    }
    return map;
  }, [data]);

  const cells = useMemo(
    () => buildGrid(dataMap, visibleWeeks, todayMs),
    [dataMap, visibleWeeks, todayMs]
  );
  const monthLabels = useMemo(() => buildMonthLabels(cells), [cells]);

  // Detect if data exists but none falls within the visible grid window
  const hasVisibleData = useMemo(() => {
    if (data.length === 0) return false;
    return cells.some((cell) => cell.data !== undefined);
  }, [data, cells]);

  // Maximum activity for intensity scaling
  const maxActivity = useMemo(() => {
    let max = 0;
    for (const point of data) {
      const val =
        viewMode === "loc"
          ? point.humanAdditions + point.aiAdditions + (point.automationAdditions ?? 0)
          : point.human + point.ai + (point.automation ?? 0);
      if (val > max) max = val;
    }
    return max;
  }, [data, viewMode]);

  // Detect if LOC view has suspiciously sparse data (possible enrichment gap)
  const locDataWarning = useMemo(() => {
    if (viewMode !== "loc" || data.length === 0) return false;
    const withLoc = data.filter(
      (d) => d.humanAdditions + d.aiAdditions + (d.automationAdditions ?? 0) > 0
    ).length;
    const withCommits = data.filter((d) => d.human + d.ai + (d.automation ?? 0) > 0).length;
    // If most days have commits but few have LOC, enrichment may be incomplete
    return withCommits > 0 && withLoc / withCommits < 0.5;
  }, [data, viewMode]);

  const totalCols =
    cells.length > 0 ? (cells[cells.length - 1]?.col ?? visibleWeeks) + 1 : visibleWeeks;
  const svgWidth = LABEL_LEFT + totalCols * CELL_STEP;
  const svgHeight = LABEL_TOP + ROWS * CELL_STEP;

  const handleMouseEnter = useCallback(
    (
      e: React.MouseEvent<SVGRectElement>,
      cell: { date: Date; data: DailyDataPoint | undefined }
    ) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const human = viewMode === "loc" ? (cell.data?.humanAdditions ?? 0) : (cell.data?.human ?? 0);
      const ai = viewMode === "loc" ? (cell.data?.aiAdditions ?? 0) : (cell.data?.ai ?? 0);
      const automation =
        viewMode === "loc" ? (cell.data?.automationAdditions ?? 0) : (cell.data?.automation ?? 0);
      const total = human + ai + automation;

      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        dateLabel: formatDate(cell.date),
        human,
        ai,
        automation,
        total,
        aiPercentage: total > 0 ? ((ai / total) * 100).toFixed(0) : "0",
      });
    },
    [viewMode]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const hasData = data.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="block w-full"
          style={{ aspectRatio: `${svgWidth} / ${svgHeight}` }}
          role="img"
          aria-label="Contribution heatmap showing human vs AI vs automation activity"
        >
          {/* Month labels along top */}
          {monthLabels.map(({ label, col }) => (
            <text
              key={`${label}-${col}`}
              x={LABEL_LEFT + col * CELL_STEP}
              y={LABEL_TOP - 5}
              className="fill-neutral-500 text-[10px]"
            >
              {label}
            </text>
          ))}

          {/* Day-of-week labels on left */}
          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={label}
                x={LABEL_LEFT - 6}
                y={LABEL_TOP + i * CELL_STEP + CELL_SIZE / 2 + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[10px]"
              >
                {label}
              </text>
            ) : null
          )}

          {/* Cells */}
          {cells.map((cell) => {
            const human =
              viewMode === "loc" ? (cell.data?.humanAdditions ?? 0) : (cell.data?.human ?? 0);
            const ai = viewMode === "loc" ? (cell.data?.aiAdditions ?? 0) : (cell.data?.ai ?? 0);
            const automation =
              viewMode === "loc"
                ? (cell.data?.automationAdditions ?? 0)
                : (cell.data?.automation ?? 0);
            const color = getSquareColor(human, ai, automation, maxActivity);

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: SVG rect hover is for tooltip progressive enhancement; parent svg has role="img" + aria-label
              <rect
                key={cell.dateMs}
                x={LABEL_LEFT + cell.col * CELL_STEP}
                y={LABEL_TOP + cell.row * CELL_STEP}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={color ?? undefined}
                className={`cursor-pointer transition-opacity hover:opacity-80 ${color === null ? "fill-neutral-800" : ""}`}
                onMouseEnter={(e) => handleMouseEnter(e, cell)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </svg>
      </div>

      {/* Empty state overlay */}
      {!hasData && !isSyncing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-500 backdrop-blur-sm border border-neutral-800">
            No commit data yet. Re-sync to populate daily activity.
          </p>
        </div>
      )}

      {/* Data exists but is all outside the visible window */}
      {hasData && !hasVisibleData && !isSyncing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-500 backdrop-blur-sm border border-neutral-800">
            All activity is older than 1 year. Heatmap shows the last 12 months.
          </p>
        </div>
      )}

      {/* LOC data warning */}
      {locDataWarning && (
        <p className="mt-1 text-[11px] text-amber-500">
          {includesPrivateData
            ? "Code volume isn\u2019t available for private repos. This view reflects public repo activity only."
            : isSyncing
              ? "Code volume data may be incomplete for some commits. Enrichment in progress..."
              : "Code volume data may be incomplete for some commits. Try re-syncing."}
        </p>
      )}

      {/* Legend — simplified discrete boxes */}
      <div className="mt-4 flex flex-col gap-3 text-[11px] text-neutral-500 border-t border-neutral-800 pt-4">
        <div>
          <span>{viewMode === "loc" ? "Code added per day" : "Commits per day"} — UTC</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <div className="flex gap-1">
              {HEATMAP_COLORS_HUMAN.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>More (Human)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
            <div className="flex gap-1">
              {HEATMAP_COLORS_AI.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>(AI)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
            <div className="flex gap-1">
              {HEATMAP_COLORS_AUTOMATION.map((c) => (
                <div key={c} className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>(Automation)</span>
          </div>
        </div>
      </div>

      {/* Tooltip — Card UI */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full min-w-[220px] overflow-hidden rounded-2xl border border-neutral-800 bg-black/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
          style={{ left: tooltip.x, top: tooltip.y - 12 }}
        >
          <div className="border-b border-white/5 bg-white/5 px-4 py-3">
            <div className="text-sm font-black tracking-tight text-white">{tooltip.dateLabel}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              {tooltip.total.toLocaleString()} {viewMode === "loc" ? "lines" : "commits"} total
              {tooltip.total > 0 && ` (${tooltip.aiPercentage}% AI)`}
            </div>
          </div>
          <div className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2 text-neutral-400">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Human
              </span>
              <span className="text-white">{tooltip.human.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2 text-neutral-400">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                AI
              </span>
              <span className="text-white">{tooltip.ai.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2 text-neutral-400">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                Automation
              </span>
              <span className="text-white">{tooltip.automation.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
