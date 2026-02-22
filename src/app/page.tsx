"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
  AlertCircle,
  Loader2,
  Heart,
  Landmark,
  ArrowUpRight,
  CalendarClock,
  Banknote,
  Sparkles,
  CheckCircle2,
  Timer,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  ChevronRight,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { formatMoney, formatDateShort, getSafeToSpendColor } from "@/lib/format";


interface DashboardData {
  safeToSpend: {
    safeToSpend: number;
    nextPayDate: string;
    daysUntilPay: number;
    upcomingExpenses: { name: string; amount: number; date: string }[];
  };
  netPosition: number;
  totalBankBalance: number;
  availableBalance: number;
  expenseAccountBalance: number;
  totalCreditCardDebt: number;
  totalBnplDebt: number;
  upcomingPayments: {
    name: string;
    amount: number;
    date: string;
    type: string;
  }[];
  spendingByCategory: { category: string; amount: number }[];
  recentTransactions: {
    id: number;
    accountId: number;
    date: string;
    rawDescription: string;
    cleanDescription: string | null;
    amount: number;
    category: string | null;
    isIncome: boolean;
  }[];
  accountsSummary: {
    bankAccounts: { name: string; balance: number }[];
    creditCards: { name: string; balance: number; limit: number | null }[];
  };
  wishlistSummary: {
    topItems: { id: number; name: string; price: number; priority: number; status: string }[];
    totalValue: number;
    itemCount: number;
  };
}

const CHART_COLORS = [
  "#c4f441",
  "#a78bfa",
  "#38bdf8",
  "#fb923c",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#f87171",
];

// Accent colors for account cards
const ACCOUNT_ACCENTS = [
  { bg: "from-violet-500/20 to-violet-600/5", border: "border-violet-500/20", icon: "text-violet-400", glow: "shadow-violet-500/5" },
  { bg: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/20", icon: "text-emerald-400", glow: "shadow-emerald-500/5" },
  { bg: "from-sky-500/20 to-sky-600/5", border: "border-sky-500/20", icon: "text-sky-400", glow: "shadow-sky-500/5" },
  { bg: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/20", icon: "text-amber-400", glow: "shadow-amber-500/5" },
  { bg: "from-rose-500/20 to-rose-600/5", border: "border-rose-500/20", icon: "text-rose-400", glow: "shadow-rose-500/5" },
  { bg: "from-cyan-500/20 to-cyan-600/5", border: "border-cyan-500/20", icon: "text-cyan-400", glow: "shadow-cyan-500/5" },
];

const CC_ACCENTS = [
  { bg: "from-orange-500/20 to-orange-600/5", border: "border-orange-500/20", icon: "text-orange-400", glow: "shadow-orange-500/5" },
  { bg: "from-pink-500/20 to-pink-600/5", border: "border-pink-500/20", icon: "text-pink-400", glow: "shadow-pink-500/5" },
  { bg: "from-indigo-500/20 to-indigo-600/5", border: "border-indigo-500/20", icon: "text-indigo-400", glow: "shadow-indigo-500/5" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Could not load dashboard data. Set up your financial profile in Settings first.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-zinc-500" />
        <p className="text-lg text-zinc-400">
          {error || "No data available"}
        </p>
        <p className="text-sm text-zinc-500">
          Add your income, accounts, and expenses in Settings to get started.
        </p>
      </div>
    );
  }

  const sts = data.safeToSpend;
  const stsColor = getSafeToSpendColor(sts.safeToSpend);

  const totalMonthlySpending = data.spendingByCategory.reduce(
    (sum, c) => sum + c.amount,
    0
  );

  const bnplPayments = data.upcomingPayments.filter((p) => p.type === "bnpl");

  return (
    <div className="space-y-6 pb-20 sm:space-y-8 lg:pb-8">
      {/* Header */}
      {/* Combined Header & Balance Card */}
      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-zinc-900 p-6 sm:p-8">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-[#c4f441]/[0.05] blur-[80px]" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-[80px]" />
        
        <div className="relative">
          {/* Top Row: Profile & Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/[0.1] bg-zinc-800 shadow-xl">
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#c4f441] to-emerald-500 text-lg font-bold text-black">
                  EZ
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-zinc-400">Welcome Back!</span>
                <h1 className="text-xl font-bold tracking-tight text-white">Etkan Zawad</h1>
              </div>
            </div>
            <button className="relative rounded-full border border-white/[0.08] bg-white/[0.03] p-3 text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white">
              <span className="absolute top-3 right-3.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-[#09090b]" />
              <div className="h-5 w-5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </div>
            </button>
          </div>

          {/* Middle Row: Balance */}
          <div className="mt-8">
            <div className="flex items-baseline gap-3">
              <h2 className="text-5xl font-bold tracking-tighter text-white sm:text-6xl">
                 {formatMoney(data.netPosition)}
              </h2>
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-sm font-medium text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>11.5%</span>
              </div>
            </div>
            
            {/* Expandable Breakdown */}
            <div className="mt-6 border-t border-white/[0.08] pt-4">
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-400 marker:content-none hover:text-white">
                  <span className="flex-1">View Breakdown</span>
                  <div className="rounded-full bg-white/[0.04] p-1 transition-transform group-open:rotate-180">
                    <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                  </div>
                </summary>
                
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-zinc-500">
                    <span>Available (savings)</span>
                    <span className="font-medium text-emerald-400/80">
                      {formatMoney(data.availableBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Bills account</span>
                    <span className="font-medium text-emerald-400/80">
                      {formatMoney(data.expenseAccountBalance)}
                    </span>
                  </div>
                  {data.totalCreditCardDebt > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Credit cards</span>
                      <span className="font-medium text-red-400/80">
                        -{formatMoney(data.totalCreditCardDebt)}
                      </span>
                    </div>
                  )}
                  {data.totalBnplDebt > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>BNPL remaining</span>
                      <span className="font-medium text-red-400/80">
                        -{formatMoney(data.totalBnplDebt)}
                      </span>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Account Balances */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-300">Accounts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.accountsSummary.bankAccounts.map((acc, i) => {
            const accent = ACCOUNT_ACCENTS[i % ACCOUNT_ACCENTS.length];
            return (
              <div
                key={acc.name}
                className={`group relative overflow-hidden rounded-xl border ${accent.border} bg-gradient-to-br ${accent.bg} p-5 transition-all hover:shadow-lg ${accent.glow}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-zinc-400">{acc.name}</p>
                    <p className="text-2xl font-bold tracking-tight text-zinc-100">
                      {formatMoney(acc.balance)}
                    </p>
                  </div>
                  <div className={`rounded-xl bg-white/[0.06] p-2.5 ${accent.icon}`}>
                    <Landmark className="h-5 w-5" />
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl transition-all group-hover:bg-white/[0.04]" />
              </div>
            );
          })}

          {data.accountsSummary.creditCards.map((cc, i) => {
            const accent = CC_ACCENTS[i % CC_ACCENTS.length];
            const utilization = cc.limit ? Math.round((cc.balance / cc.limit) * 100) : null;
            return (
              <div
                key={cc.name}
                className={`group relative overflow-hidden rounded-xl border ${accent.border} bg-gradient-to-br ${accent.bg} p-5 transition-all hover:shadow-lg ${accent.glow}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-400">{cc.name}</p>
                      {utilization !== null && (
                        <Badge
                          variant="secondary"
                          className={`border-0 text-xs font-semibold ${
                            utilization > 80
                              ? "bg-red-500/15 text-red-400"
                              : utilization > 50
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {utilization}% used
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-red-400">
                      -{formatMoney(cc.balance)}
                    </p>
                    {cc.limit && (
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization! > 80
                                ? "bg-red-500"
                                : utilization! > 50
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(utilization!, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-600">
                          {formatMoney(cc.limit)} limit
                        </p>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl bg-white/[0.06] p-2.5 ${accent.icon}`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl transition-all group-hover:bg-white/[0.04]" />
              </div>
            );
          })}
        </div>
      </div>

      {/* BNPL Payments + Spending */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* BNPL Upcoming Payments */}
        <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="rounded-lg bg-violet-500/10 p-1.5">
                <CalendarClock className="h-4 w-4 text-violet-400" />
              </div>
              BNPL Payments
            </CardTitle>
            <CardDescription className="text-zinc-600">Upcoming instalments due in 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {bnplPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-violet-500/[0.06] p-3">
                  <ShoppingCart className="h-5 w-5 text-violet-400/50" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  No BNPL payments due in the next 14 days
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {bnplPayments.map((payment, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                        <ShoppingCart className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {payment.name}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {formatDateShort(payment.date)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-400">
                      -{formatMoney(payment.amount)}
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3 px-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">Total due</span>
                  <span className="text-sm font-bold tabular-nums text-zinc-300">
                    {formatMoney(bnplPayments.reduce((sum, p) => sum + p.amount, 0))}
                  </span>
                </div>
              </div>
            )}
            {data.totalBnplDebt > 0 && (
              <Link
                href="/bnpl"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              >
                View all BNPL plans
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Spending This Month */}
        <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="rounded-lg bg-[#c4f441]/10 p-1.5">
                <TrendingDown className="h-4 w-4 text-[#c4f441]" />
              </div>
              Spending This Month
            </CardTitle>
            <CardDescription className="text-zinc-600">
              {totalMonthlySpending > 0
                ? `Total: ${formatMoney(totalMonthlySpending)}`
                : "No spending recorded this month"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.spendingByCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-[#c4f441]/[0.06] p-3">
                  <TrendingDown className="h-5 w-5 text-[#c4f441]/50" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  Import transactions in Statements to see spending breakdown
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="h-44 w-full sm:w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.spendingByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="amount"
                        nameKey="category"
                        stroke="none"
                      >
                        {data.spendingByCategory.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "rgb(24 24 27)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        }}
                        formatter={(value) => formatMoney(Number(value ?? 0))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2.5">
                  {data.spendingByCategory
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map((cat, i) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="text-zinc-500">
                            {cat.category}
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums text-zinc-300">
                          {formatMoney(cat.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
