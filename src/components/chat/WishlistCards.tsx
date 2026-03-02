"use client";

import { Star, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WishlistCardData, ChatAction } from "@/lib/ui-components";

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  wanted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  saving: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  purchased: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function WishlistCards({
  data,
  title,
  onAction,
}: {
  data: WishlistCardData;
  title: string;
  onAction?: (action: ChatAction) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="grid grid-cols-1 gap-2">
        {data.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {item.store && (
                    <span className="text-[10px] text-zinc-500">{item.store}</span>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border ${STATUS_STYLES[item.status] || ""}`}
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#c4f441] shrink-0">{fmt(item.price)}</p>
            </div>

            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < item.priority ? "fill-amber-400 text-amber-400" : "text-zinc-700"}`}
                  />
                ))}
              </div>
              {item.status !== "purchased" && onAction && (
                <button
                  onClick={() =>
                    onAction({
                      type: "send_message",
                      content: `Can I afford ${item.name} at $${item.price.toFixed(2)}?`,
                    })
                  }
                  className="flex items-center gap-1 rounded-md bg-[#c4f441]/10 px-2 py-1 text-[10px] font-medium text-[#c4f441] transition-colors hover:bg-[#c4f441]/20"
                >
                  <ShoppingCart className="h-3 w-3" />
                  Check Affordability
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
