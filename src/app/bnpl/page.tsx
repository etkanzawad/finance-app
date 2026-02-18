"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatMoney,
  formatDate,
  dollarsToCents,
  centsToDollars,
} from "@/lib/format";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  CreditCard,
  Zap,
  DollarSign,
  TrendingDown,
  Clock,
  Loader2,
  Receipt,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

interface BnplPlan {
  id: number;
  bnplAccountId: number;
  itemName: string;
  totalAmount: number;
  instalmentAmount: number;
  instalmentFrequency: string;
  instalmentsTotal: number;
  instalmentsRemaining: number;
  nextPaymentDate: string;
  createdAt: string;
  provider: string;
  spendingLimit: number;
  availableLimit: number;
}

interface BnplAccount {
  id: number;
  provider: string;
  spendingLimit: number;
  availableLimit: number;
  isActive: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  afterpay: "Afterpay",
  zip_pay: "Zip Pay",
  zip_money: "Zip Money",
  paypal_pay4: "PayPal Pay in 4",
};

const PROVIDER_BADGE_STYLES: Record<string, string> = {
  afterpay: "bg-teal-500/15 text-teal-400 border-0",
  zip_pay: "bg-violet-500/15 text-violet-400 border-0",
  zip_money: "bg-indigo-500/15 text-indigo-400 border-0",
  paypal_pay4: "bg-sky-500/15 text-sky-400 border-0",
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  afterpay: <CreditCard className="h-3.5 w-3.5" />,
  zip_pay: <Zap className="h-3.5 w-3.5" />,
  zip_money: <Zap className="h-3.5 w-3.5" />,
  paypal_pay4: <Wallet className="h-3.5 w-3.5" />,
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

const FREQ_BADGE_STYLES: Record<string, string> = {
  weekly: "bg-amber-500/15 text-amber-400 border-0",
  fortnightly: "bg-sky-500/15 text-sky-400 border-0",
  monthly: "bg-zinc-500/15 text-zinc-500 border-0",
};

export default function BnplPage() {
  const [plans, setPlans] = useState<BnplPlan[]>([]);
  const [accounts, setAccounts] = useState<BnplAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BnplPlan | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // Form state
  const [formAccountId, setFormAccountId] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formTotalAmount, setFormTotalAmount] = useState("");
  const [formInstalmentAmount, setFormInstalmentAmount] = useState("");
  const [formFrequency, setFormFrequency] = useState("fortnightly");
  const [formInstalmentsTotal, setFormInstalmentsTotal] = useState("");
  const [formInstalmentsRemaining, setFormInstalmentsRemaining] = useState("");
  const [formNextPaymentDate, setFormNextPaymentDate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [plansRes] = await Promise.all([
        fetch("/api/bnpl-plans"),
        fetch("/api/accounts"),
      ]);
      const plansData = await plansRes.json();
      setPlans(plansData);

      const bnplRes = await fetch("/api/bnpl-accounts");
      if (bnplRes.ok) {
        const bnplData = await bnplRes.json();
        setAccounts(bnplData);
      }
    } catch {
      toast.error("Failed to load BNPL data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setFormAccountId("");
    setFormItemName("");
    setFormTotalAmount("");
    setFormInstalmentAmount("");
    setFormFrequency("fortnightly");
    setFormInstalmentsTotal("");
    setFormInstalmentsRemaining("");
    setFormNextPaymentDate("");
    setEditingPlan(null);
  }

  function openEdit(plan: BnplPlan) {
    setEditingPlan(plan);
    setFormAccountId(String(plan.bnplAccountId));
    setFormItemName(plan.itemName);
    setFormTotalAmount(centsToDollars(plan.totalAmount).toFixed(2));
    setFormInstalmentAmount(centsToDollars(plan.instalmentAmount).toFixed(2));
    setFormFrequency(plan.instalmentFrequency);
    setFormInstalmentsTotal(String(plan.instalmentsTotal));
    setFormInstalmentsRemaining(String(plan.instalmentsRemaining));
    setFormNextPaymentDate(plan.nextPaymentDate);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      bnplAccountId: Number(formAccountId),
      itemName: formItemName,
      totalAmount: dollarsToCents(parseFloat(formTotalAmount)),
      instalmentAmount: dollarsToCents(parseFloat(formInstalmentAmount)),
      instalmentFrequency: formFrequency,
      instalmentsTotal: Number(formInstalmentsTotal),
      instalmentsRemaining: Number(formInstalmentsRemaining),
      nextPaymentDate: formNextPaymentDate,
    };

    try {
      if (editingPlan) {
        await fetch(`/api/bnpl-plans/${editingPlan.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Plan updated");
      } else {
        await fetch("/api/bnpl-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Plan added");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to save plan");
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/bnpl-plans/${id}`, { method: "DELETE" });
      toast.success("Plan deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete plan");
    }
  }

  async function handleRecordPayment(id: number) {
    try {
      const res = await fetch(`/api/bnpl-plans/${id}/record-payment`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.completed) {
        toast.success("Plan fully paid off!");
      } else {
        toast.success("Payment recorded");
      }
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment"
      );
    }
  }

  async function handlePaidOff(id: number) {
    try {
      await fetch(`/api/bnpl-plans/${id}`, { method: "DELETE" });
      toast.success("Plan marked as paid off");
      fetchData();
    } catch {
      toast.error("Failed to mark as paid off");
    }
  }

  // Calculate metrics
  const totalExposure = plans.reduce(
    (sum, p) => sum + p.instalmentAmount * p.instalmentsRemaining,
    0
  );
  const totalMonthlyCommitment = plans.reduce((sum, p) => {
    const multiplier =
      p.instalmentFrequency === "weekly"
        ? 4.33
        : p.instalmentFrequency === "fortnightly"
          ? 2.17
          : 1;
    return sum + p.instalmentAmount * multiplier;
  }, 0);

  // Provider summaries
  const providerSummary = plans.reduce(
    (acc, p) => {
      if (!acc[p.provider]) {
        acc[p.provider] = {
          provider: p.provider,
          spendingLimit: p.spendingLimit,
          availableLimit: p.availableLimit,
          activePlans: 0,
          totalOwed: 0,
        };
      }
      acc[p.provider].activePlans++;
      acc[p.provider].totalOwed +=
        p.instalmentAmount * p.instalmentsRemaining;
      return acc;
    },
    {} as Record<
      string,
      {
        provider: string;
        spendingLimit: number;
        availableLimit: number;
        activePlans: number;
        totalOwed: number;
      }
    >
  );

  // Calendar data — project all future payment dates per plan
  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth(),
  }));
  const daysInMonth = new Date(
    calendarMonth.year,
    calendarMonth.month + 1,
    0
  ).getDate();

  function advanceDateBy(dateStr: string, frequency: string): string {
    const d = new Date(dateStr + "T00:00:00");
    switch (frequency) {
      case "weekly":
        d.setDate(d.getDate() + 7);
        break;
      case "fortnightly":
        d.setDate(d.getDate() + 14);
        break;
      case "monthly":
        d.setMonth(d.getMonth() + 1);
        break;
    }
    return d.toISOString().split("T")[0];
  }

  // Build a map of day -> plans for the viewed calendar month
  const calendarDates: Record<number, BnplPlan[]> = {};
  for (const plan of plans) {
    let date = plan.nextPaymentDate;
    let remaining = plan.instalmentsRemaining;
    // Walk through all future payment dates for this plan
    while (remaining > 0) {
      const d = new Date(date + "T00:00:00");
      if (
        d.getFullYear() === calendarMonth.year &&
        d.getMonth() === calendarMonth.month
      ) {
        const day = d.getDate();
        if (!calendarDates[day]) calendarDates[day] = [];
        calendarDates[day].push(plan);
      }
      // Stop projecting past the viewed month (optimisation)
      if (
        d.getFullYear() > calendarMonth.year ||
        (d.getFullYear() === calendarMonth.year &&
          d.getMonth() > calendarMonth.month)
      ) {
        break;
      }
      date = advanceDateBy(date, plan.instalmentFrequency);
      remaining--;
    }
  }

  function goToPrevMonth() {
    setCalendarMonth((prev) => {
      const m = prev.month - 1;
      return m < 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: m };
    });
  }

  function goToNextMonth() {
    setCalendarMonth((prev) => {
      const m = prev.month + 1;
      return m > 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: m };
    });
  }

  // Filtered plans
  const filteredPlans =
    providerFilter === "all"
      ? plans
      : plans.filter((p) => p.provider === providerFilter);

  // Unique providers for filter tabs
  const uniqueProviders = [...new Set(plans.map((p) => p.provider))];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BNPL Tracker</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track all your buy-now-pay-later commitments
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51] active:bg-[#b4e431]">
              <Plus className="mr-2 h-4 w-4" /> Add Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="border-white/[0.08] bg-zinc-900">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Edit Plan" : "Add BNPL Plan"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">BNPL Account</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {PROVIDER_LABELS[a.provider] || a.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Item Name</Label>
                <Input
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  placeholder="e.g. Nike Air Max"
                  className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Total Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formTotalAmount}
                    onChange={(e) => setFormTotalAmount(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Instalment ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formInstalmentAmount}
                    onChange={(e) => setFormInstalmentAmount(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Total Instalments</Label>
                  <Input
                    type="number"
                    value={formInstalmentsTotal}
                    onChange={(e) => setFormInstalmentsTotal(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Remaining</Label>
                  <Input
                    type="number"
                    value={formInstalmentsRemaining}
                    onChange={(e) =>
                      setFormInstalmentsRemaining(e.target.value)
                    }
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Next Payment Date</Label>
                <Input
                  type="date"
                  value={formNextPaymentDate}
                  onChange={(e) => setFormNextPaymentDate(e.target.value)}
                  className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51]"
              >
                {editingPlan ? "Update Plan" : "Add Plan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Hero Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/[0.07] via-transparent to-red-500/[0.04]" />
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-amber-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-red-500/[0.04] blur-3xl" />
        <div className="relative grid gap-8 sm:grid-cols-3">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              Total Exposure
            </div>
            <p className="mt-4 text-5xl font-bold tracking-tighter text-amber-400">
              {formatMoney(totalExposure)}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              across {plans.length} active{" "}
              {plans.length === 1 ? "plan" : "plans"}
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              Monthly Commitment
            </div>
            <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-100">
              {formatMoney(Math.round(totalMonthlyCommitment))}
            </p>
            <p className="mt-2 text-sm text-zinc-500">estimated per month</p>
          </div>

          <div className="text-center sm:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <Receipt className="h-3.5 w-3.5 text-[#c4f441]" />
              Active Plans
            </div>
            <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-100">
              {plans.length}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {uniqueProviders.length}{" "}
              {uniqueProviders.length === 1 ? "provider" : "providers"}
            </p>
          </div>
        </div>
      </div>

      {/* Provider Summary Cards */}
      {Object.keys(providerSummary).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(providerSummary).map((ps) => {
            const used = ps.spendingLimit - ps.availableLimit;
            const utilisation =
              ps.spendingLimit > 0 ? (used / ps.spendingLimit) * 100 : 0;
            return (
              <Card
                key={ps.provider}
                className="group relative overflow-hidden border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm transition-all hover:shadow-lg"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-lg bg-white/[0.06] p-2 ${
                        ps.provider === "afterpay"
                          ? "text-teal-400"
                          : ps.provider === "zip_pay" ||
                              ps.provider === "zip_money"
                            ? "text-violet-400"
                            : "text-sky-400"
                      }`}
                    >
                      {PROVIDER_ICONS[ps.provider] || (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-zinc-100">
                        {PROVIDER_LABELS[ps.provider] || ps.provider}
                      </CardTitle>
                      <CardDescription className="text-zinc-600">
                        {ps.activePlans} active plan
                        {ps.activePlans !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Limit</span>
                    <span className="font-medium tabular-nums text-zinc-300">
                      {formatMoney(ps.spendingLimit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Used</span>
                    <span className="font-medium tabular-nums text-zinc-300">
                      {formatMoney(used)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Available</span>
                    <span className="font-medium tabular-nums text-emerald-400">
                      {formatMoney(ps.availableLimit)}
                    </span>
                  </div>
                  {/* Custom progress bar matching wishlist style */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        utilisation > 80
                          ? "bg-red-500"
                          : utilisation > 50
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(utilisation, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-zinc-600">
                      {Math.round(utilisation)}% utilised
                    </span>
                  </div>
                </CardContent>
                <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/[0.01] blur-2xl transition-all group-hover:bg-white/[0.03]" />
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Calendar */}
      <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[#c4f441]/20 to-[#c4f441]/5 p-2.5">
                <CalendarDays className="h-5 w-5 text-[#c4f441]" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Payment Calendar
                </CardTitle>
                <CardDescription className="text-zinc-600">
                  All projected payment dates
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                onClick={goToPrevMonth}
              >
                &larr;
              </Button>
              <span className="min-w-[140px] text-center text-sm font-medium text-zinc-300">
                {new Date(
                  calendarMonth.year,
                  calendarMonth.month
                ).toLocaleDateString("en-AU", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                onClick={goToNextMonth}
              >
                &rarr;
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-zinc-600"
              >
                {day}
              </div>
            ))}
            {Array.from({
              length:
                (new Date(
                  calendarMonth.year,
                  calendarMonth.month,
                  1
                ).getDay() +
                  6) %
                7,
            }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPlans = calendarDates[day];
              const isToday =
                day === now.getDate() &&
                calendarMonth.month === now.getMonth() &&
                calendarMonth.year === now.getFullYear();
              return (
                <div
                  key={day}
                  className={`relative rounded-lg border p-2 text-center text-sm transition-all ${
                    isToday
                      ? "border-[#c4f441]/30 bg-[#c4f441]/[0.06]"
                      : "border-white/[0.04] bg-white/[0.01]"
                  } ${dayPlans ? "border-amber-500/30 bg-amber-500/[0.06]" : ""}`}
                >
                  <span
                    className={
                      isToday
                        ? "font-bold text-[#c4f441]"
                        : dayPlans
                          ? "font-medium text-amber-400"
                          : "text-zinc-500"
                    }
                  >
                    {day}
                  </span>
                  {dayPlans && (
                    <div className="mt-1">
                      {dayPlans.map((p) => (
                        <div
                          key={p.id}
                          className="truncate text-[10px] font-medium text-amber-400/80"
                        >
                          {p.itemName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["all", ...uniqueProviders].map((provider) => (
          <button
            key={provider}
            onClick={() => setProviderFilter(provider)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              providerFilter === provider
                ? "bg-[#c4f441] text-zinc-900"
                : "border border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            {provider === "all"
              ? "All Plans"
              : PROVIDER_LABELS[provider] || provider}
          </button>
        ))}
      </div>

      {/* Plan Cards */}
      {filteredPlans.length === 0 ? (
        <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-amber-500/[0.06] p-4">
              <CreditCard className="h-8 w-8 text-amber-400/50" />
            </div>
            <p className="text-lg font-medium text-zinc-300">
              {plans.length === 0
                ? "No active BNPL plans"
                : "No plans match this filter"}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {plans.length === 0
                ? "Add a plan to start tracking your commitments."
                : "Try a different filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPlans.map((plan) => {
            const paid = plan.instalmentsTotal - plan.instalmentsRemaining;
            const progress = paid / plan.instalmentsTotal;
            const remainingAmount =
              plan.instalmentAmount * plan.instalmentsRemaining;
            const isAlmostDone = progress >= 0.75;
            const nextDate = new Date(plan.nextPaymentDate);
            const isOverdue = nextDate < now;

            return (
              <Card
                key={plan.id}
                className={`group relative overflow-hidden border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm transition-all hover:shadow-lg ${
                  isAlmostDone
                    ? "border-emerald-500/20"
                    : isOverdue
                      ? "border-red-500/20"
                      : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="text-zinc-100">{plan.itemName}</span>
                        {isAlmostDone && (
                          <Badge
                            variant="secondary"
                            className="border-0 bg-emerald-500/15 text-xs font-semibold text-emerald-400"
                          >
                            Almost done!
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge
                            variant="secondary"
                            className="border-0 bg-red-500/15 text-xs font-semibold text-red-400"
                          >
                            Overdue
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${PROVIDER_BADGE_STYLES[plan.provider] || "bg-zinc-500/15 text-zinc-500 border-0"}`}
                        >
                          {PROVIDER_LABELS[plan.provider] || plan.provider}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${FREQ_BADGE_STYLES[plan.instalmentFrequency] || "bg-zinc-500/15 text-zinc-500 border-0"}`}
                        >
                          {FREQ_LABELS[plan.instalmentFrequency]}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-lg font-bold tabular-nums tracking-tight text-zinc-100">
                      {formatMoney(plan.totalAmount)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Progress */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-300">
                        Payment Progress
                      </span>
                      <span className="text-xs tabular-nums text-zinc-500">
                        {paid} / {plan.instalmentsTotal} paid
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress >= 1
                            ? "bg-emerald-500"
                            : progress >= 0.75
                              ? "bg-emerald-500"
                              : progress >= 0.5
                                ? "bg-amber-500"
                                : "bg-sky-500"
                        }`}
                        style={{
                          width: `${Math.min(progress * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Per Instalment
                      </p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">
                        {formatMoney(plan.instalmentAmount)}
                      </p>
                    </div>
                    <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Remaining
                      </p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-amber-400">
                        {formatMoney(remainingAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Next Payment */}
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <Clock
                      className={`h-3.5 w-3.5 ${isOverdue ? "text-red-400" : "text-zinc-600"}`}
                    />
                    <span className="text-xs text-zinc-500">
                      Next payment:
                    </span>
                    <span
                      className={`text-xs font-semibold ${isOverdue ? "text-red-400" : "text-zinc-300"}`}
                    >
                      {formatDate(plan.nextPaymentDate)}
                    </span>
                    {isOverdue && (
                      <AlertTriangle className="ml-auto h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-[#c4f441]/20 bg-[#c4f441]/[0.06] text-xs text-[#c4f441] hover:bg-[#c4f441]/10"
                      onClick={() => handleRecordPayment(plan.id)}
                    >
                      <Banknote className="mr-1 h-3 w-3" />
                      Record Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-emerald-500/20 bg-emerald-500/[0.06] text-xs text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => handlePaidOff(plan.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Paid Off
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-600 hover:text-zinc-300"
                      onClick={() => openEdit(plan)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-600 hover:text-red-400"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
                <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/[0.01] blur-2xl transition-all group-hover:bg-white/[0.03]" />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
