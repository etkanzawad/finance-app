"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TransactionsTableData } from "@/lib/ui-components";

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TransactionsTable({ data, title }: { data: TransactionsTableData; title: string }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? data.transactions : data.transactions.slice(0, 8);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-1">
        {visible.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
            <span className="text-[10px] text-zinc-600 w-12 shrink-0">
              {new Date(tx.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
            <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">
              {tx.description}
            </span>
            {tx.category && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 hidden sm:inline-flex">
                {tx.category}
              </Badge>
            )}
            <span className={`text-xs font-medium shrink-0 tabular-nums ${tx.amount >= 0 || tx.isIncome ? "text-emerald-400" : "text-zinc-300"}`}>
              {tx.amount >= 0 || tx.isIncome ? "+" : "-"}{fmt(tx.amount)}
            </span>
          </div>
        ))}
      </div>
      {data.transactions.length > 8 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-white/[0.04]"
        >
          Show all {data.transactions.length} transactions <ChevronDown className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
