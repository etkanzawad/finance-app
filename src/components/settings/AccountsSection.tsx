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
import { formatMoney, formatMoneyPlain, dollarsToCents } from "@/lib/format";
import { Plus, Pencil, Trash2, Landmark, CreditCard } from "lucide-react";
import type { Account } from "@/lib/db/schema";

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

export function AccountsSection() {
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
