"use client";

import { useEffect, useState, useCallback } from "react";
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
import { formatMoney, formatMoneyPlain, dollarsToCents } from "@/lib/format";
import { Plus, Pencil, Trash2, ShoppingBag, FileText } from "lucide-react";
import { BnplAgreementUpload } from "@/components/bnpl/BnplAgreementUpload";
import type { BnplAccount } from "@/lib/db/schema";

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

const BNPL_PROVIDERS: Record<string, string> = {
  afterpay: "Afterpay",
  zip_pay: "Zip Pay",
  zip_money: "Zip Money",
  paypal_pay4: "PayPal Pay in 4",
};

export function BnplAccountsSection() {
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
    <div className="space-y-6">
      {/* BNPL Accounts */}
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
      </div>

      {/* BNPL Agreement Uploads */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-amber-500/10 p-1.5">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
          </div>
          BNPL Agreements
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Upload Buy Now Pay Later agreement documents for record-keeping.
        </p>
        <div className="mt-4">
          <BnplAgreementUpload />
        </div>
      </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
