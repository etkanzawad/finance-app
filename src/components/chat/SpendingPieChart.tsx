"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { SpendingPieChartData } from "@/lib/ui-components";

const COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48",
];

export function SpendingPieChart({ data, title }: { data: SpendingPieChartData; title: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data.segments}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={10}
          >
            {data.segments.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Amount"]}
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              color: "#e4e4e7",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
