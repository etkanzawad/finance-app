"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney, formatMoneyPlain, dollarsToCents, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import type { Income, Account } from "@/lib/db/schema";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, message, accent }: { icon: React.ElementType; message: string; accent: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.04] bg-zinc-900/30 py-10 text-center">
      <div className={`rounded-full bg-${accent}-500/[0.06] p-3`}>
        <Icon className={`h-5 w-5 text-${accent}-400/40`} />
      </div>
      <p className="mt-3 text-sm text-zinc-600">{message}</p>
    </div>
  );
}

export function IncomeSection() {
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
