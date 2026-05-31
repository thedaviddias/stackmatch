"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface VersionDistributionChartProps {
  data: Array<{ version: string; count: number }>;
}

interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { version: string; count: number };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">
        {label}
      </p>
      <p className="text-sm font-black text-emerald-400">
        {payload[0]?.value}{" "}
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">
          {payload[0]?.value === 1 ? "repo" : "repos"}
        </span>
      </p>
    </div>
  );
}

export function VersionDistributionChart({ data }: VersionDistributionChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="version"
          width={100}
          tick={{ fill: "#a3a3a3", fontSize: 12, fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar
          dataKey="count"
          fill="#34d399"
          radius={[0, 4, 4, 0]}
          barSize={20}
          label={{ position: "right", fill: "#737373", fontSize: 11 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
