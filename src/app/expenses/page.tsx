"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  formatMoney,
  formatMoneyPlain,
  dollarsToCents,
  formatDate,
} from "@/lib/format";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Repeat,
  CalendarClock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

import type { FixedExpense } from "@/lib/db/schema";

const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Transport",
  "Health",
  "Education",
  "Childcare",
  "Debt Repayment",
  "Other",
];

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

/** Normalize any frequency to a monthly cents amount */
function toMonthlyCents(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return Math.round(amount * 52 / 12);
    case "fortnightly":
      return Math.round(amount * 26 / 12);
    case "quarterly":
      return Math.round(amount / 3);
    case "yearly":
      return Math.round(amount / 12);
    default:
      return amount;
  }
}

type DialogMode = "bill" | "sub";

export default function ExpensesPage() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("bill");
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
    nextDueDate: "",
    category: "",
    isActive: true,
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/fixed-expenses");
    const data: FixedExpense[] = await res.json();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bills = useMemo(
    () => items.filter((e) => e.category !== "Subscriptions"),
    [items]
  );
  const subs = useMemo(
    () => items.filter((e) => e.category === "Subscriptions"),
    [items]
  );

  // Summary calculations
  const totalMonthlyBills = useMemo(
    () =>
      bills
        .filter((b) => b.isActive)
        .reduce((sum, b) => sum + toMonthlyCents(b.amount, b.frequency), 0),
    [bills]
  );
  const totalMonthlySubs = useMemo(
    () => subs.filter((s) => s.isActive).reduce((sum, s) => sum + s.amount, 0),
    [subs]
  );
  const totalMonthly = totalMonthlyBills + totalMonthlySubs;

  const upcomingCount = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return items.filter((i) => {
      if (!i.isActive) return false;
      const due = new Date(i.nextDueDate);
      return due >= now && due <= weekFromNow;
    }).length;
  }, [items]);

  // Dialog helpers
  function openNewBill() {
    setDialogMode("bill");
    setEditing(null);
    setForm({
      name: "",
      amount: "",
      frequency: "monthly",
      nextDueDate: "",
      category: "",
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openNewSub() {
    setDialogMode("sub");
    setEditing(null);
    setForm({
      name: "",
      amount: "",
      frequency: "monthly",
      nextDueDate: "",
      category: "Subscriptions",
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openEdit(item: FixedExpense) {
    setDialogMode(item.category === "Subscriptions" ? "sub" : "bill");
    setEditing(item);
    setForm({
      name: item.name,
      amount: formatMoneyPlain(item.amount),
      frequency: item.frequency,
      nextDueDate: item.nextDueDate,
      category: item.category ?? "",
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const isSub = dialogMode === "sub";
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      amount: dollarsToCents(parseFloat(form.amount)),
      frequency: isSub ? "monthly" : form.frequency,
      nextDueDate: form.nextDueDate,
      category: isSub ? "Subscriptions" : form.category || null,
      isActive: form.isActive,
    };
    const res = await fetch("/api/fixed-expenses", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const label = isSub ? "Subscription" : "Expense";
      toast.success(editing ? `${label} updated` : `${label} added`);
      setDialogOpen(false);
      load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/fixed-expenses?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      load();
    }
  }

  const isSub = dialogMode === "sub";

  return (
    <div className="space-y-8 pb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Monthly Total"
          value={formatMoney(totalMonthly)}
          icon={TrendingUp}
          color="text-[#c4f441]"
          bgColor="bg-[#c4f441]/[0.06]"
          borderColor="border-[#c4f441]/10"
        />
        <SummaryCard
          label="Bills"
          value={formatMoney(totalMonthlyBills)}
          sub={`${bills.filter((b) => b.isActive).length} active`}
          icon={Receipt}
          color="text-amber-400"
          bgColor="bg-amber-500/[0.06]"
          borderColor="border-amber-500/10"
        />
        <SummaryCard
          label="Subscriptions"
          value={formatMoney(totalMonthlySubs)}
          sub={`${subs.filter((s) => s.isActive).length} active`}
          icon={Repeat}
          color="text-pink-400"
          bgColor="bg-pink-500/[0.06]"
          borderColor="border-pink-500/10"
        />
      </div>

      {/* Upcoming alert */}
      {upcomingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-zinc-300">
            <span className="font-semibold text-amber-400">{upcomingCount}</span>{" "}
            {upcomingCount === 1 ? "expense due" : "expenses due"} in the next 7 days
          </span>
        </div>
      )}

      {/* Bills Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/[0.08] p-1.5">
              <Receipt className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Bills</h2>
            <span className="text-sm text-zinc-600">
              ({bills.filter((b) => b.isActive).length})
            </span>
          </div>
          <Button
            onClick={openNewBill}
            size="sm"
            className="bg-amber-500 font-medium text-zinc-900 hover:bg-amber-400"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Bill
          </Button>
        </div>

        {bills.length === 0 && !loading ? (
          <EmptyState icon={Receipt} message="No bills yet" accent="amber" />
        ) : (
          <div className="grid gap-2">
            {bills.map((item) => (
              <ExpenseRow
                key={item.id}
                item={item}
                accentColor="text-amber-400"
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Subscriptions Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-pink-500/[0.08] p-1.5">
              <Repeat className="h-4 w-4 text-pink-400" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Subscriptions
            </h2>
            <span className="text-sm text-zinc-600">
              ({subs.filter((s) => s.isActive).length})
            </span>
          </div>
          <Button
            onClick={openNewSub}
            size="sm"
            className="bg-pink-500 font-medium text-white hover:bg-pink-400"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Sub
          </Button>
        </div>

        {subs.length === 0 && !loading ? (
          <EmptyState
            icon={Repeat}
            message="No subscriptions yet"
            accent="pink"
          />
        ) : (
          <div className="grid gap-2">
            {subs.map((item) => (
              <ExpenseRow
                key={item.id}
                item={item}
                accentColor="text-pink-400"
                showFrequency={false}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Shared Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isSub
                  ? "Edit Subscription"
                  : "Edit Bill"
                : isSub
                  ? "Add Subscription"
                  : "Add Bill"}
            </DialogTitle>
            <DialogDescription>
              {isSub
                ? "Enter the details for this subscription service."
                : "Enter the details for this recurring expense."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label={isSub ? "Service Name" : "Name"}>
              <Input
                placeholder={isSub ? "e.g. Netflix, Spotify" : "e.g. Rent"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label={isSub ? "Monthly Cost ($)" : "Amount ($)"}>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </FormField>
            {!isSub && (
              <FormField label="Frequency">
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label={isSub ? "Next Billing Date" : "Next Due Date"}>
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) =>
                  setForm({ ...form, nextDueDate: e.target.value })
                }
              />
            </FormField>
            {!isSub && (
              <FormField label="Category">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label className="text-sm text-zinc-400">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.amount || !form.nextDueDate}
              className={
                isSub
                  ? "bg-pink-500 text-white hover:bg-pink-400"
                  : "bg-amber-500 text-zinc-900 hover:bg-amber-400"
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sub-components ----

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} px-4 py-4`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${color} opacity-60`} />
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function ExpenseRow({
  item,
  accentColor,
  showFrequency = true,
  onEdit,
  onDelete,
}: {
  item: FixedExpense;
  accentColor: string;
  showFrequency?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDueSoon = (() => {
    const due = new Date(item.nextDueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div
      className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02] ${
        !item.isActive ? "opacity-50" : ""
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-200">{item.name}</p>
          {item.category && item.category !== "Subscriptions" && (
            <Badge
              variant="secondary"
              className="border-0 bg-white/[0.04] text-xs font-medium text-zinc-500"
            >
              {item.category}
            </Badge>
          )}
          {!item.isActive && (
            <Badge
              variant="secondary"
              className="border-0 bg-white/[0.04] text-xs text-zinc-600"
            >
              Inactive
            </Badge>
          )}
          {isDueSoon && item.isActive && (
            <Badge
              variant="secondary"
              className="border-0 bg-amber-500/10 text-xs font-medium text-amber-400"
            >
              Due soon
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-xs text-zinc-500">
          <span className={`font-semibold tabular-nums ${accentColor}`}>
            {formatMoney(item.amount)}
            {item.category === "Subscriptions" ? "/mo" : ""}
          </span>
          {showFrequency && (
            <Badge
              variant="secondary"
              className="border-0 bg-white/[0.04] text-xs font-medium text-zinc-500"
            >
              {FREQUENCY_LABELS[item.frequency]}
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDate(item.nextDueDate)}
          </span>
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-500 hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  accent,
}: {
  icon: React.ElementType;
  message: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.04] bg-zinc-900/30 py-10 text-center">
      <div className={`rounded-full bg-${accent}-500/[0.06] p-3`}>
        <Icon className={`h-5 w-5 text-${accent}-400/40`} />
      </div>
      <p className="mt-3 text-sm text-zinc-600">{message}</p>
    </div>
  );
}
