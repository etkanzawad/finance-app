"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingCart,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import StatementsSection from "@/components/StatementsSection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonEntry {
  person: string;
  sent: number;
  received: number;
  net: number;
  count: number;
  lastDate: string;
}

interface MerchantEntry {
  merchant: string;
  category: string;
  visitCount: number;
  totalSpent: number;
  avgPerVisit: number;
  lastDate: string;
}

interface AnomalyCategory {
  category: string;
  current: number;
  previous: number;
  changePercent: number | null;
  isAnomaly: boolean;
  direction: "up" | "down";
}

interface AnomaliesData {
  month: string;
  prevMonth: string;
  categories: AnomalyCategory[];
}

type Tab = "statements" | "people" | "merchants" | "anomalies";
type MerchantSort = "visits" | "total";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  return `$${(abs / 100).toFixed(2)}`;
}

function fmtSigned(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function fmtMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const CATEGORY_COLOURS: Record<string, string> = {
  Groceries: "bg-emerald-500/15 text-emerald-400",
  Dining: "bg-orange-500/15 text-orange-400",
  Transport: "bg-blue-500/15 text-blue-400",
  Entertainment: "bg-purple-500/15 text-purple-400",
  Shopping: "bg-pink-500/15 text-pink-400",
  Health: "bg-teal-500/15 text-teal-400",
  Utilities: "bg-yellow-500/15 text-yellow-400",
  "Rent/Housing": "bg-sky-500/15 text-sky-400",
  Subscriptions: "bg-violet-500/15 text-violet-400",
  Insurance: "bg-cyan-500/15 text-cyan-400",
  Transfers: "bg-zinc-500/15 text-zinc-400",
  Income: "bg-green-500/15 text-green-400",
  "Cash Withdrawal": "bg-stone-500/15 text-stone-400",
  Fees: "bg-red-500/15 text-red-400",
  Other: "bg-zinc-600/15 text-zinc-500",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("statements");
  const [month, setMonth] = useState(defaultMonth);
  const [allTime, setAllTime] = useState(false);

  const [people, setPeople] = useState<PersonEntry[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [merchants, setMerchants] = useState<MerchantEntry[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [sortBy, setSortBy] = useState<MerchantSort>("visits");

  const [anomalies, setAnomalies] = useState<AnomaliesData | null>(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);

  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const params = allTime ? "" : `?month=${month}`;
      const res = await fetch(`/api/insights/transfers${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setPeople(data);
    } catch {
      toast.error("Failed to load transfer data");
    }
    setLoadingPeople(false);
  }, [month, allTime]);

  const fetchMerchants = useCallback(async () => {
    setLoadingMerchants(true);
    try {
      const params = allTime ? "" : `?month=${month}`;
      const res = await fetch(`/api/insights/merchants${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setMerchants(data);
    } catch {
      toast.error("Failed to load merchant data");
    }
    setLoadingMerchants(false);
  }, [month, allTime]);

  const fetchAnomalies = useCallback(async () => {
    setLoadingAnomalies(true);
    try {
      const res = await fetch(`/api/insights/anomalies?month=${month}`);
      const data = await res.json();
      if (data.categories) setAnomalies(data);
    } catch {
      toast.error("Failed to load anomaly data");
    }
    setLoadingAnomalies(false);
  }, [month]);

  useEffect(() => { if (tab === "people") fetchPeople(); }, [tab, fetchPeople]);
  useEffect(() => { if (tab === "merchants") fetchMerchants(); }, [tab, fetchMerchants]);
  useEffect(() => { if (tab === "anomalies") fetchAnomalies(); }, [tab, fetchAnomalies]);

  const sortedMerchants = [...merchants].sort((a, b) =>
    sortBy === "visits" ? b.visitCount - a.visitCount : b.totalSpent - a.totalSpent
  );
  const maxMerchantVal = Math.max(
    1,
    ...sortedMerchants.map((m) => (sortBy === "visits" ? m.visitCount : m.totalSpent))
  );

  const anomalyCount = anomalies?.categories.filter((c) => c.isAnomaly).length ?? 0;

  return (
    <div className="flex-1 min-h-screen bg-zinc-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Insights</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Patterns and anomalies from your transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "anomalies" && (
            <button
              onClick={() => setAllTime(!allTime)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                allTime
                  ? "bg-[#c4f441]/15 text-[#c4f441]"
                  : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All time
            </button>
          )}
          {!allTime && (
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-1 py-1">
              <button
                onClick={() => setMonth(prevMonth(month))}
                className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[88px] text-center text-sm font-medium text-zinc-300">
                {fmtMonth(month)}
              </span>
              <button
                onClick={() => setMonth(nextMonth(month))}
                className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-1 w-full sm:w-fit overflow-x-auto no-scrollbar">
        {(
          [
            { id: "statements" as Tab, label: "Statements", icon: FileText },
            { id: "people" as Tab, label: "People", icon: Users },
            { id: "merchants" as Tab, label: "Merchants", icon: ShoppingCart },
            {
              id: "anomalies" as Tab,
              label: "Anomalies",
              icon: AlertTriangle,
              badge: anomalyCount,
            },
          ] as { id: Tab; label: string; icon: React.ElementType; badge?: number }[]
        ).map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── STATEMENTS ─────────────────────────────────────────────────────── */}
      {tab === "statements" && <StatementsSection />}

      {/* ── PEOPLE ─────────────────────────────────────────────────────────── */}
      {tab === "people" && (
        <div className="space-y-3">
          {loadingPeople ? (
            <Spinner />
          ) : people.length === 0 ? (
            <Empty icon={Users} message="No transfer transactions found" sub='Transactions categorised as "Transfers" appear here' />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => (
                <div
                  key={p.person}
                  className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm leading-tight truncate">
                        {p.person}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {p.count} txn{p.count !== 1 ? "s" : ""} · last {fmtDate(p.lastDate)}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${
                        p.net > 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : p.net < 0
                          ? "bg-red-500/15 text-red-400"
                          : "bg-zinc-600/15 text-zinc-400"
                      }`}
                    >
                      {p.net === 0 ? "Even" : fmtSigned(p.net)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-red-500/[0.06] p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ArrowUpRight className="h-3 w-3 text-red-400" />
                        <span className="text-xs text-zinc-500">Sent</span>
                      </div>
                      <p className="text-sm font-semibold text-red-400">{fmt(p.sent)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/[0.06] p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                        <span className="text-xs text-zinc-500">Received</span>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">{fmt(p.received)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MERCHANTS ──────────────────────────────────────────────────────── */}
      {tab === "merchants" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort by:</span>
            {(["visits", "total"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortBy === s
                    ? "bg-zinc-800 text-white"
                    : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s === "visits" ? "Most visited" : "Most spent"}
              </button>
            ))}
          </div>

          {loadingMerchants ? (
            <Spinner />
          ) : merchants.length === 0 ? (
            <Empty icon={ShoppingCart} message="No merchant data found" />
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 overflow-hidden">
              {sortedMerchants.map((m, i) => (
                <div
                  key={m.merchant}
                  className={`flex items-center gap-4 px-4 py-3 ${
                    i !== 0 ? "border-t border-white/[0.04]" : ""
                  }`}
                >
                  <span className="w-5 text-xs font-mono text-zinc-600 flex-shrink-0 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-medium text-zinc-200 truncate">{m.merchant}</p>
                      <span
                        className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                          CATEGORY_COLOURS[m.category] ?? CATEGORY_COLOURS.Other
                        }`}
                      >
                        {m.category}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#c4f441]/40 transition-all"
                        style={{
                          width: `${
                            ((sortBy === "visits" ? m.visitCount : m.totalSpent) / maxMerchantVal) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-200">
                      {sortBy === "visits" ? `${m.visitCount}×` : fmt(m.totalSpent)}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {sortBy === "visits" ? fmt(m.totalSpent) : `${m.visitCount} visits`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANOMALIES ──────────────────────────────────────────────────────── */}
      {tab === "anomalies" && (
        <div className="space-y-4">
          {loadingAnomalies ? (
            <Spinner />
          ) : !anomalies ? (
            <Empty icon={AlertTriangle} message="No data for this month" />
          ) : (
            <>
              {anomalyCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-500/80">
                    {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"} vs{" "}
                    {fmtMonth(anomalies.prevMonth)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {anomalies.categories
                      .filter((c) => c.isAnomaly)
                      .map((c) => (
                        <div
                          key={c.category}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{c.category}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                vs {fmtMonth(anomalies.prevMonth)}
                              </p>
                            </div>
                            <div
                              className={`flex items-center gap-1 text-sm font-bold ${
                                c.direction === "up" ? "text-red-400" : "text-emerald-400"
                              }`}
                            >
                              {c.direction === "up" ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {c.changePercent !== null
                                ? `${c.changePercent > 0 ? "+" : ""}${c.changePercent}%`
                                : "New"}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-zinc-600">This month</p>
                              <p className="text-base font-bold text-white">{fmt(c.current)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-zinc-600">Last month</p>
                              <p className="text-base font-bold text-zinc-400">{fmt(c.previous)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 flex items-center gap-3">
                  <TrendingDown className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-400">
                    No significant anomalies vs {fmtMonth(anomalies.prevMonth)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  All categories — {fmtMonth(month)} vs {fmtMonth(anomalies.prevMonth)}
                </p>
                <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 overflow-hidden">
                  {anomalies.categories.map((c, i) => (
                    <div
                      key={c.category}
                      className={`flex items-center gap-4 px-4 py-3 ${
                        i !== 0 ? "border-t border-white/[0.04]" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-300 truncate">{c.category}</p>
                        {c.isAnomaly && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-right flex-shrink-0">
                        <div className="w-20">
                          <p className="text-xs text-zinc-600">Prev</p>
                          <p className="text-sm text-zinc-500">
                            {c.previous > 0 ? fmt(c.previous) : "—"}
                          </p>
                        </div>
                        <div className="w-20">
                          <p className="text-xs text-zinc-600">Now</p>
                          <p className="text-sm font-semibold text-zinc-200">
                            {c.current > 0 ? fmt(c.current) : "—"}
                          </p>
                        </div>
                        <div className="w-14 text-right">
                          {c.changePercent !== null ? (
                            <span
                              className={`text-sm font-medium ${
                                c.direction === "up" ? "text-red-400" : "text-emerald-400"
                              }`}
                            >
                              {c.changePercent > 0 ? "+" : ""}
                              {c.changePercent}%
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
    </div>
  );
}

function Empty({
  icon: Icon,
  message,
  sub,
}: {
  icon: React.ElementType;
  message: string;
  sub?: string;
}) {
  return (
    <div className="py-16 text-center rounded-xl border border-white/[0.06] bg-zinc-900/40">
      <Icon className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
      <p className="text-sm text-zinc-500">{message}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}
