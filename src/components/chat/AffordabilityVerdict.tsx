"use client";

import { CircleCheck, CircleX, Wallet, Clock } from "lucide-react";
import type { AffordabilityVerdictData } from "@/lib/ui-components";

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AffordabilityVerdict({ data, title }: { data: AffordabilityVerdictData; title: string }) {
  return (
    <div className={`rounded-xl border p-4 ${
      data.canAfford
        ? "border-emerald-500/20 bg-emerald-500/[0.04]"
        : "border-red-500/20 bg-red-500/[0.04]"
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {data.canAfford ? (
          <CircleCheck className="h-8 w-8 text-emerald-400 shrink-0" />
        ) : (
          <CircleX className="h-8 w-8 text-red-400 shrink-0" />
        )}
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
          <p className="text-xs text-zinc-400">
            {data.canAfford
              ? "You can comfortably afford this!"
              : "This might stretch your budget."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
          <p className="text-[10px] text-zinc-500 uppercase">Item Price</p>
          <p className="text-sm font-semibold text-zinc-200">{fmt(data.price)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="flex items-center gap-1">
            <Wallet className="h-3 w-3 text-zinc-500" />
            <p className="text-[10px] text-zinc-500 uppercase">Safe to Spend</p>
          </div>
          <p className={`text-sm font-semibold ${data.safeToSpend > data.price ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(data.safeToSpend)}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
          <p className="text-[10px] text-zinc-500 uppercase">Available Balance</p>
          <p className="text-sm font-semibold text-zinc-200">{fmt(data.availableBalance)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            <p className="text-[10px] text-zinc-500 uppercase">Next Pay</p>
          </div>
          <p className="text-sm font-semibold text-zinc-200">
            {data.daysUntilPay} day{data.daysUntilPay !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
