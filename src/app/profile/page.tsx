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
  User,
  Lock,
  Unlock,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  CreditCard,
  ShoppingBag,
  Receipt,
  Repeat,
  Landmark,
  Loader2,
} from "lucide-react";

import type { Income, Account, BnplAccount, FixedExpense } from "@/lib/db/schema";

// ---- Tab type ----
type ProfileTab = "profile" | "income" | "accounts" | "bnpl" | "bills" | "subs";

const TABS: { id: ProfileTab; label: string; icon: React.ElementType; accent: string }[] = [
  { id: "profile", label: "Profile", icon: User, accent: "text-sky-400" },
  { id: "income", label: "Income", icon: DollarSign, accent: "text-emerald-400" },
  { id: "accounts", label: "Accounts", icon: Landmark, accent: "text-violet-400" },
  { id: "bnpl", label: "BNPL", icon: ShoppingBag, accent: "text-orange-400" },
  { id: "bills", label: "Bills", icon: Receipt, accent: "text-amber-400" },
  { id: "subs", label: "Subs", icon: Repeat, accent: "text-pink-400" },
];

// ---- Profile & PIN Section ----

function ProfileSection() {
  const [name, setName] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        setHasPin(data.hasPin);
        setLoading(false);
      });
  }, []);

  async function saveName() {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) toast.success("Name updated");
    else toast.error("Failed to save");
  }

  async function handleSetPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs don't match");
      return;
    }
    const body: Record<string, string> = {
      action: hasPin ? "change_pin" : "set_pin",
      pin: newPin,
    };
    if (hasPin) body.currentPin = currentPin;

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success(hasPin ? "PIN changed" : "PIN set");
      setHasPin(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to update PIN");
    }
  }

  async function handleRemovePin() {
    if (!currentPin) {
      toast.error("Enter your current PIN to remove it");
      return;
    }
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_pin", currentPin }),
    });
    if (res.ok) {
      toast.success("PIN removed");
      setHasPin(false);
      setCurrentPin("");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to remove PIN");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Display Name */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-sky-500/10 p-1.5">
            <User className="h-3.5 w-3.5 text-sky-400" />
          </div>
          Display Name
        </div>
        <div className="mt-4 flex gap-3">
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-sky-500/30"
          />
          <Button
            size="sm"
            onClick={saveName}
            disabled={!name.trim()}
            className="bg-sky-500 font-medium text-white hover:bg-sky-400 active:bg-sky-600"
          >
            Save
          </Button>
        </div>
      </div>

      {/* PIN Lock */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              {hasPin ? (
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </div>
            PIN Lock
          </div>
          {hasPin && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              Active
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {hasPin
            ? "Your app is protected with a 4-digit PIN"
            : "Set a 4-digit PIN to lock the app on startup"}
        </p>

        <div className="mt-4 space-y-4">
          {hasPin && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Current PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={currentPin}
                onChange={(e) =>
                  setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
          )}

          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">
                {hasPin ? "New PIN" : "PIN"}
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Confirm</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSetPin}
              disabled={
                newPin.length !== 4 ||
                confirmPin.length !== 4 ||
                (hasPin && currentPin.length !== 4)
              }
              className="bg-emerald-500 font-medium text-white hover:bg-emerald-400"
            >
              {hasPin ? "Change PIN" : "Set PIN"}
            </Button>
            {hasPin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemovePin}
                disabled={currentPin.length !== 4}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                Remove PIN
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Income Section ----

function IncomeSection() {
  const [items, setItems] = useState<Income[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "fortnightly",
    nextPayDate: "",
    accountId: "",
  });

  const load = useCallback(async () => {
    const [incRes, accRes] = await Promise.all([
      fetch("/api/income"),
      fetch("/api/accounts"),
    ]);
    setItems(await incRes.json());
    const accs = await accRes.json();
    if (Array.isArray(accs)) setAccounts(accs.filter((a: Account) => a.type === "bank"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", amount: "", frequency: "fortnightly", nextPayDate: "", accountId: "" });
    setDialogOpen(true);
  }

  function openEdit(item: Income) {
    setEditing(item);
    setForm({
      name: item.name,
      amount: formatMoneyPlain(item.amount),
      frequency: item.frequency,
      nextPayDate: item.nextPayDate,
      accountId: item.accountId ? String(item.accountId) : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      amount: dollarsToCents(parseFloat(form.amount)),
      frequency: form.frequency,
      nextPayDate: form.nextPayDate,
      accountId: form.accountId && form.accountId !== "none" ? Number(form.accountId) : null,
    };
    const res = await fetch("/api/income", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? "Income updated" : "Income added");
      setDialogOpen(false);
      load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/income?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Income deleted");
      load();
    }
  }

  const frequencyLabel: Record<string, string> = {
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Manage your regular income sources</p>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-emerald-500 font-medium text-white hover:bg-emerald-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Income
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={DollarSign} message="No income sources configured" accent="emerald" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02]"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-200">{item.name}</p>
                <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                  <span className="font-semibold tabular-nums text-emerald-400">
                    {formatMoney(item.amount)}
                  </span>
                  <Badge
                    variant="secondary"
                    className="border-0 bg-white/[0.04] text-xs font-medium text-zinc-500"
                  >
                    {frequencyLabel[item.frequency]}
                  </Badge>
                  <span>Next: {formatDate(item.nextPayDate)}</span>
                  {item.accountId && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-violet-500/10 text-xs font-medium text-violet-400"
                    >
                      {accounts.find((a) => a.id === item.accountId)?.name || "Linked"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Income" : "Add Income"}</DialogTitle>
            <DialogDescription>Enter the details for this income source.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name">
              <Input
                placeholder="e.g. Salary"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Amount ($)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </FormField>
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
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Next Pay Date">
              <Input
                type="date"
                value={form.nextPayDate}
                onChange={(e) =>
                  setForm({ ...form, nextPayDate: e.target.value })
                }
              />
            </FormField>
            <FormField label="Deposit to Account">
              <Select
                value={form.accountId}
                onValueChange={(v) => setForm({ ...form, accountId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (manual)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (manual)</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-600">
                Auto-credits this account on payday
              </p>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || !form.amount || !form.nextPayDate}
              className="bg-emerald-500 text-white hover:bg-emerald-400"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Accounts Section ----

function AccountsSection() {
  const [items, setItems] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [editingBalanceId, setEditingBalanceId] = useState<number | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "bank",
    balance: "",
    creditLimit: "",
    interestRate: "",
    statementDate: "",
    dueDate: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/accounts");
    setItems(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", type: "bank", balance: "", creditLimit: "", interestRate: "", statementDate: "", dueDate: "" });
    setDialogOpen(true);
  }

  function openEdit(item: Account) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      balance: formatMoneyPlain(item.balance),
      creditLimit: item.creditLimit ? formatMoneyPlain(item.creditLimit) : "",
      interestRate: item.interestRate ?? "",
      statementDate: item.statementDate?.toString() ?? "",
      dueDate: item.dueDate?.toString() ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      type: form.type,
      balance: dollarsToCents(parseFloat(form.balance) || 0),
      creditLimit: form.creditLimit
        ? dollarsToCents(parseFloat(form.creditLimit))
        : null,
      interestRate: form.interestRate || null,
      statementDate: form.statementDate ? parseInt(form.statementDate) : null,
      dueDate: form.dueDate ? parseInt(form.dueDate) : null,
    };
    const res = await fetch("/api/accounts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? "Account updated" : "Account added");
      setDialogOpen(false);
      load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Account deleted");
      load();
    }
  }

  async function saveBalance(item: Account) {
    const cents = dollarsToCents(parseFloat(balanceInput) || 0);
    const res = await fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        name: item.name,
        type: item.type,
        balance: cents,
        creditLimit: item.creditLimit,
        interestRate: item.interestRate,
        statementDate: item.statementDate,
        dueDate: item.dueDate,
      }),
    });
    if (res.ok) {
      toast.success(`${item.name} balance updated`);
      setEditingBalanceId(null);
      load();
    } else {
      toast.error("Failed to update balance");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Bank accounts and credit cards</p>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-violet-500 font-medium text-white hover:bg-violet-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Account
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Landmark} message="No accounts configured" accent="violet" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`rounded-lg p-1.5 ${
                      item.type === "bank"
                        ? "bg-violet-500/10"
                        : "bg-orange-500/10"
                    }`}
                  >
                    {item.type === "bank" ? (
                      <Landmark className="h-3.5 w-3.5 text-violet-400" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200">
                        {item.name}
                      </p>
                      <Badge
                        variant="secondary"
                        className="border-0 bg-white/[0.04] text-xs font-medium text-zinc-500"
                      >
                        {item.type === "bank" ? "Bank" : "Credit Card"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-600">
                      {item.creditLimit && (
                        <span>Limit: {formatMoney(item.creditLimit)}</span>
                      )}
                      {item.interestRate && (
                        <span>{item.interestRate}% APR</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-400"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-2.5">
                {editingBalanceId === item.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-40 border-white/[0.08] bg-white/[0.03] text-sm focus-visible:ring-violet-500/30"
                      value={balanceInput}
                      onChange={(e) => setBalanceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveBalance(item);
                        if (e.key === "Escape") setEditingBalanceId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-violet-500 text-xs text-white hover:bg-violet-400"
                      onClick={() => saveBalance(item)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-zinc-500"
                      onClick={() => setEditingBalanceId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    className="group/bal flex cursor-pointer items-center gap-1.5"
                    onClick={() => {
                      setBalanceInput(formatMoneyPlain(item.balance));
                      setEditingBalanceId(item.id);
                    }}
                  >
                    <span
                      className={`text-xl font-bold tabular-nums tracking-tight ${
                        item.type === "credit_card"
                          ? "text-red-400"
                          : "text-zinc-100"
                      }`}
                    >
                      {item.type === "credit_card" && "-"}
                      {formatMoney(item.balance)}
                    </span>
                    <Pencil className="h-3 w-3 text-zinc-700 opacity-0 transition-opacity group-hover/bal:opacity-100" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Account" : "Add Account"}
            </DialogTitle>
            <DialogDescription>
              Enter the details for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name">
              <Input
                placeholder="e.g. CommBank Everyday"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Type">
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Balance ($)">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </FormField>
            {form.type === "credit_card" && (
              <>
                <FormField label="Credit Limit ($)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.creditLimit}
                    onChange={(e) =>
                      setForm({ ...form, creditLimit: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Interest Rate (%)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="19.99"
                    value={form.interestRate}
                    onChange={(e) =>
                      setForm({ ...form, interestRate: e.target.value })
                    }
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Statement Date (day)">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="15"
                      value={form.statementDate}
                      onChange={(e) =>
                        setForm({ ...form, statementDate: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Due Date (day)">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="28"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name}
              className="bg-violet-500 text-white hover:bg-violet-400"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- BNPL Section ----

const BNPL_PROVIDERS: Record<string, string> = {
  afterpay: "Afterpay",
  zip_pay: "Zip Pay",
  zip_money: "Zip Money",
  paypal_pay4: "PayPal Pay in 4",
};

function BnplSection() {
  const [items, setItems] = useState<BnplAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BnplAccount | null>(null);
  const [form, setForm] = useState({
    provider: "afterpay",
    spendingLimit: "",
    availableLimit: "",
    lateFeeAmount: "",
    isActive: true,
    notes: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/bnpl-accounts");
    setItems(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({
      provider: "afterpay",
      spendingLimit: "",
      availableLimit: "",
      lateFeeAmount: "",
      isActive: true,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(item: BnplAccount) {
    setEditing(item);
    setForm({
      provider: item.provider,
      spendingLimit: formatMoneyPlain(item.spendingLimit),
      availableLimit: formatMoneyPlain(item.availableLimit),
      lateFeeAmount: item.lateFeeAmount
        ? formatMoneyPlain(item.lateFeeAmount)
        : "",
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const lateFee =
      form.provider === "afterpay"
        ? 1000
        : form.lateFeeAmount
        ? dollarsToCents(parseFloat(form.lateFeeAmount))
        : null;
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      provider: form.provider,
      spendingLimit: dollarsToCents(parseFloat(form.spendingLimit) || 0),
      availableLimit: dollarsToCents(parseFloat(form.availableLimit) || 0),
      lateFeeAmount: lateFee,
      isActive: form.isActive,
      notes: form.notes || null,
    };
    const res = await fetch("/api/bnpl-accounts", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? "BNPL account updated" : "BNPL account added");
      setDialogOpen(false);
      load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/bnpl-accounts?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("BNPL account deleted");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Buy Now Pay Later providers</p>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-orange-500 font-medium text-white hover:bg-orange-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add BNPL
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ShoppingBag} message="No BNPL accounts configured" accent="orange" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02] ${
                !item.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {BNPL_PROVIDERS[item.provider] ?? item.provider}
                  </p>
                  <Badge
                    variant="secondary"
                    className={`border-0 text-xs font-medium ${
                      item.isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/[0.04] text-zinc-600"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>
                    Limit:{" "}
                    <span className="tabular-nums text-zinc-400">
                      {formatMoney(item.spendingLimit)}
                    </span>
                  </span>
                  <span>
                    Available:{" "}
                    <span className="tabular-nums text-emerald-400/80">
                      {formatMoney(item.availableLimit)}
                    </span>
                  </span>
                </div>
                {item.notes && (
                  <p className="text-xs text-zinc-600">{item.notes}</p>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit BNPL Account" : "Add BNPL Account"}
            </DialogTitle>
            <DialogDescription>
              Enter the details for this BNPL account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Provider">
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BNPL_PROVIDERS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {form.provider === "afterpay" && (
              <div className="space-y-2 rounded-lg border border-orange-500/10 bg-orange-500/[0.04] p-3 text-sm">
                <p className="font-medium text-orange-400">How Afterpay works</p>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-zinc-500">
                  <li>4 interest-free payments over 6 weeks</li>
                  <li>25% due at purchase, 3 remaining fortnightly</li>
                  <li>Late fee: $10 initial + $7 after 7 days</li>
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Spending Limit ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.spendingLimit}
                  onChange={(e) =>
                    setForm({ ...form, spendingLimit: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Available Limit ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.availableLimit}
                  onChange={(e) =>
                    setForm({ ...form, availableLimit: e.target.value })
                  }
                />
              </FormField>
            </div>
            {form.provider !== "afterpay" && (
              <FormField label="Late Fee Amount ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.lateFeeAmount}
                  onChange={(e) =>
                    setForm({ ...form, lateFeeAmount: e.target.value })
                  }
                />
              </FormField>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label className="text-sm text-zinc-400">Active</Label>
            </div>
            <FormField label="Notes">
              <Input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.spendingLimit}
              className="bg-orange-500 text-white hover:bg-orange-400"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Bills Section ----

const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Transport",
  "Subscriptions",
  "Health",
  "Education",
  "Childcare",
  "Debt Repayment",
  "Other",
];

function BillsSection() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    const all: FixedExpense[] = await res.json();
    setItems(all.filter((e) => e.category !== "Subscriptions"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
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

  function openEdit(item: FixedExpense) {
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
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      amount: dollarsToCents(parseFloat(form.amount)),
      frequency: form.frequency,
      nextDueDate: form.nextDueDate,
      category: form.category || null,
      isActive: form.isActive,
    };
    const res = await fetch("/api/fixed-expenses", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? "Expense updated" : "Expense added");
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
      toast.success("Expense deleted");
      load();
    }
  }

  const frequencyLabel: Record<string, string> = {
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Recurring bills and commitments
        </p>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-amber-500 font-medium text-zinc-900 hover:bg-amber-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Bill
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Receipt} message="No bills configured" accent="amber" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02] ${
                !item.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {item.name}
                  </p>
                  {item.category && (
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
                </div>
                <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                  <span className="font-semibold tabular-nums text-amber-400">
                    {formatMoney(item.amount)}
                  </span>
                  <Badge
                    variant="secondary"
                    className="border-0 bg-white/[0.04] text-xs font-medium text-zinc-500"
                  >
                    {frequencyLabel[item.frequency]}
                  </Badge>
                  <span>Next: {formatDate(item.nextDueDate)}</span>
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              Enter the details for this fixed expense.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name">
              <Input
                placeholder="e.g. Rent"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Amount ($)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </FormField>
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
            <FormField label="Next Due Date">
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) =>
                  setForm({ ...form, nextDueDate: e.target.value })
                }
              />
            </FormField>
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
              className="bg-amber-500 text-zinc-900 hover:bg-amber-400"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Subscriptions Section ----

function SubsSection() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    nextDueDate: "",
    isActive: true,
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/fixed-expenses");
    const all: FixedExpense[] = await res.json();
    setItems(all.filter((e) => e.category === "Subscriptions"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", amount: "", nextDueDate: "", isActive: true });
    setDialogOpen(true);
  }

  function openEdit(item: FixedExpense) {
    setEditing(item);
    setForm({
      name: item.name,
      amount: formatMoneyPlain(item.amount),
      nextDueDate: item.nextDueDate,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      amount: dollarsToCents(parseFloat(form.amount)),
      frequency: "monthly",
      nextDueDate: form.nextDueDate,
      category: "Subscriptions",
      isActive: form.isActive,
    };
    const res = await fetch("/api/fixed-expenses", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(editing ? "Subscription updated" : "Subscription added");
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
      toast.success("Subscription deleted");
      load();
    }
  }

  const totalMonthly = items
    .filter((i) => i.isActive)
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Recurring subscription services
        </p>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-pink-500 font-medium text-white hover:bg-pink-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Sub
        </Button>
      </div>

      {/* Monthly total */}
      <div className="flex items-center justify-between rounded-xl border border-pink-500/10 bg-pink-500/[0.04] px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Monthly total
        </span>
        <span className="text-lg font-bold tabular-nums text-pink-400">
          {formatMoney(totalMonthly)}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Repeat} message="No subscriptions configured" accent="pink" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.02] ${
                !item.isActive ? "opacity-50" : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-200">
                    {item.name}
                  </p>
                  {!item.isActive && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-white/[0.04] text-xs text-zinc-600"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                  <span className="font-semibold tabular-nums text-pink-400">
                    {formatMoney(item.amount)}/mo
                  </span>
                  <span>Next: {formatDate(item.nextDueDate)}</span>
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Subscription" : "Add Subscription"}
            </DialogTitle>
            <DialogDescription>
              Enter the details for this subscription service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Service Name">
              <Input
                placeholder="e.g. Netflix, Spotify"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Monthly Cost ($)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </FormField>
            <FormField label="Next Billing Date">
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) =>
                  setForm({ ...form, nextDueDate: e.target.value })
                }
              />
            </FormField>
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
              className="bg-pink-500 text-white hover:bg-pink-400"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Shared Components ----

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

// ---- Main Profile Page ----

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your profile and financial setup
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-1 backdrop-blur-sm">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/[0.08] text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400"
              }`}
            >
              <tab.icon
                className={`h-3.5 w-3.5 ${isActive ? tab.accent : ""}`}
              />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "profile" && <ProfileSection />}
        {activeTab === "income" && <IncomeSection />}
        {activeTab === "accounts" && <AccountsSection />}
        {activeTab === "bnpl" && <BnplSection />}
        {activeTab === "bills" && <BillsSection />}
        {activeTab === "subs" && <SubsSection />}
      </div>
    </div>
  );
}
