"use client";

import Link from "next/link";
import { CreditCard, Calendar, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { BnplCardData } from "@/lib/ui-components";

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BnplCards({ data, title }: { data: BnplCardData; title: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-3">
        {data.plans.map((plan) => {
          const paid = plan.instalmentsTotal - plan.instalmentsRemaining;
          const progress = plan.instalmentsTotal > 0 ? (paid / plan.instalmentsTotal) * 100 : 0;
          return (
            <div key={plan.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{plan.itemName}</p>
                  <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                    {plan.provider}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-red-400 shrink-0">{fmt(plan.remainingDebt)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>{paid} of {plan.instalmentsTotal} paid</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-white/[0.06]" />
              </div>

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {fmt(plan.instalmentAmount)} / {plan.frequency}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Next: {new Date(plan.nextPaymentDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <Link
        href="/bnpl"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-white/[0.04]"
      >
        View All BNPL Plans <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
