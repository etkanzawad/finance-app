"use client";

import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { SavingsGoalsProgressData } from "@/lib/ui-components";

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SavingsGoalsProgress({ data, title }: { data: SavingsGoalsProgressData; title: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-3">
        {data.goals.map((goal) => (
          <div key={goal.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="h-3.5 w-3.5 text-[#c4f441] shrink-0" />
                <span className="text-sm text-zinc-200 truncate">{goal.name}</span>
              </div>
              <span className="text-xs text-zinc-400 shrink-0 ml-2">
                {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={goal.progressPercent} className="h-1.5 flex-1 bg-white/[0.06]" />
              <span className="text-[10px] font-medium text-zinc-500 w-8 text-right">
                {goal.progressPercent.toFixed(0)}%
              </span>
            </div>
            {goal.deadline && (
              <p className="text-[10px] text-zinc-600 pl-5">
                Deadline: {new Date(goal.deadline).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        ))}
      </div>
      <Link
        href="/goals"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-white/[0.04]"
      >
        View All Goals <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
