"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NpmDownloadPoint } from "@/lib/server/package-data/npm-package-data";
import { formatDownloads } from "@/lib/server/package-data/npm-package-data";

interface DownloadTrendChartProps {
  data: NpmDownloadPoint[];
}

function formatWeekLabel(day: string): string {
  const date = new Date(day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: NpmDownloadPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">
        {formatWeekLabel(label)}
      </p>
      <p className="text-sm font-black text-indigo-400">
        {formatDownloads(payload[0]?.value ?? 0)}{" "}
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">
          downloads
        </span>
      </p>
    </div>
  );
}

export function DownloadTrendChart({ data }: DownloadTrendChartProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tickFormatter={formatWeekLabel}
          tick={{ fill: "#737373", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          tickFormatter={formatDownloads}
          tick={{ fill: "#737373", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="downloads"
          stroke="#818cf8"
          strokeWidth={2}
          fill="url(#downloadGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#818cf8", stroke: "#1e1e2e", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
