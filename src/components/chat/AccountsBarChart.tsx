"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AccountsBarChartData } from "@/lib/ui-components";

export function AccountsBarChart({ data, title }: { data: AccountsBarChartData; title: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={Math.max(120, data.accounts.length * 40)}>
        <BarChart data={data.accounts} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `$${v.toLocaleString()}`}
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Balance"]}
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              color: "#e4e4e7",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="balance" radius={[0, 4, 4, 0]} barSize={20}>
            {data.accounts.map((account, idx) => (
              <Cell
                key={idx}
                fill={account.type === "credit_card" ? "#ef4444" : "#10b981"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Bank
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Credit Card
        </div>
      </div>
    </div>
  );
}
