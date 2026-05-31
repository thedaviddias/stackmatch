"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface DepTypeDonutChartProps {
  depCount: number;
  devDepCount: number;
}

const COLORS = ["#60a5fa", "#a78bfa"]; // blue-400 for dep, violet-400 for devDep

interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { fill: string };
  }>;
}

function CustomTooltip({ active, payload }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">
        {entry.name}
      </p>
      <p className="text-sm font-black" style={{ color: entry.payload?.fill }}>
        {entry.value}{" "}
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">
          uses
        </span>
      </p>
    </div>
  );
}

export function DepTypeDonutChart({ depCount, devDepCount }: DepTypeDonutChartProps) {
  const total = depCount + devDepCount;
  if (total === 0) return null;

  const data = [
    { name: "dependency", value: depCount },
    { name: "devDependency", value: devDepCount },
  ];

  const depPct = Math.round((depCount / total) * 100);
  const devPct = 100 - depPct;

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={64}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={data[i]?.name} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[0] }} />
          <span className="text-neutral-300">
            dependency <span className="font-semibold text-white">{depPct}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[1] }} />
          <span className="text-neutral-300">
            devDependency <span className="font-semibold text-white">{devPct}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
