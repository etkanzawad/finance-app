"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
// Progress bars implemented with custom divs for consistent styling
import {
  formatMoney,
  dollarsToCents,
  centsToDollars,
} from "@/lib/format";
import {
  Plus,
  Pencil,
  Trash2,
  Heart,
  Sparkles,
  ExternalLink,
  ShoppingBag,
  Target,
  Loader2,
  Archive,
  CheckCircle2,
  Link as LinkIcon,
  Bot,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  Banknote,
  Zap,
  TrendingUp,
  Clock,
  XCircle,
  DollarSign,
  RefreshCw,
  TrendingDown,
  Tag,
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

interface WishlistItem {
  id: number;
  name: string;
  price: number;
  url: string | null;
  store: string | null;
  priority: number;
  notes: string | null;
  category: string | null;
  status: string;
  linkedGoalId: number | null;
  dateAdded: string;
  datePurchased: string | null;
  createdAt: string;
  goalName: string | null;
  goalCurrentAmount: number | null;
  goalTargetAmount: number | null;
}

interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

interface PriceCheckResult {
  itemId: number;
  itemName: string;
  originalPrice: number;
  currentPrice: number | null;
  foreignPrice: number | null;
  foreignCurrency: string | null;
  onSale: boolean;
  saleLabel: string | null;
  priceDifference: number;
  percentChange: number;
  url: string;
  lastChecked: string;
  error: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "US$",
  EUR: "€",
  NZD: "NZ$",
  CAD: "C$",
  JPY: "¥",
  SGD: "S$",
  HKD: "HK$",
  CNY: "¥",
};

interface PriceCheckResponse {
  results: PriceCheckResult[];
  summary: {
    totalChecked: number;
    priceDrops: number;
    priceIncreases: number;
    onSale: number;
    unchanged: number;
    errors: number;
    totalSavings: number;
  };
  checkedAt: string;
}

interface BnplAdvisorItem {
  itemId: number;
  itemName: string;
  price: number;
  canAfford: boolean;
  recommendation: string;
  recommendedProvider: string | null;
  reasoning: string;
  paymentBreakdown: string;
  warnings: string[];
}

interface BnplAdvisorResult {
  items: BnplAdvisorItem[];
  overallSummary: string;
  bnplHealthCheck: string;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Someday",
};

const PRIORITY_BADGE_STYLES: Record<number, string> = {
  1: "bg-red-500/15 text-red-400 border-0",
  2: "bg-orange-500/15 text-orange-400 border-0",
  3: "bg-amber-500/15 text-amber-400 border-0",
  4: "bg-sky-500/15 text-sky-400 border-0",
  5: "bg-zinc-500/15 text-zinc-500 border-0",
};

const STATUS_LABELS: Record<string, string> = {
  wanted: "Wanted",
  saving: "Saving",
  purchased: "Purchased",
  archived: "Archived",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  wanted: "bg-violet-500/15 text-violet-400 border-0",
  saving: "bg-amber-500/15 text-amber-400 border-0",
  purchased: "bg-emerald-500/15 text-emerald-400 border-0",
  archived: "bg-zinc-500/15 text-zinc-500 border-0",
};

const RECOMMENDATION_STYLES: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  buy_cash: { bg: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/20", icon: "text-emerald-400", label: "Buy with Cash" },
  use_afterpay: { bg: "from-teal-500/20 to-teal-600/5", border: "border-teal-500/20", icon: "text-teal-400", label: "Use Afterpay" },
  use_zip_pay: { bg: "from-violet-500/20 to-violet-600/5", border: "border-violet-500/20", icon: "text-violet-400", label: "Use Zip Pay" },
  save_up: { bg: "from-amber-500/20 to-amber-600/5", border: "border-amber-500/20", icon: "text-amber-400", label: "Save Up" },
  wait: { bg: "from-sky-500/20 to-sky-600/5", border: "border-sky-500/20", icon: "text-sky-400", label: "Wait" },
  skip: { bg: "from-red-500/20 to-red-600/5", border: "border-red-500/20", icon: "text-red-400", label: "Skip" },
};

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  buy_cash: <Banknote className="h-4 w-4" />,
  use_afterpay: <CreditCard className="h-4 w-4" />,
  use_zip_pay: <Zap className="h-4 w-4" />,
  save_up: <TrendingUp className="h-4 w-4" />,
  wait: <Clock className="h-4 w-4" />,
  skip: <XCircle className="h-4 w-4" />,
};

const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home",
  "Gaming",
  "Health",
  "Travel",
  "Education",
  "Food",
  "Other",
];

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingsBalance, setSavingsBalance] = useState<{ name: string; balance: number } | null>(null);
  const [bnplAdvisor, setBnplAdvisor] = useState<BnplAdvisorResult | null>(null);
  const [bnplAdvisorLoading, setBnplAdvisorLoading] = useState(false);
  const [priceCheck, setPriceCheck] = useState<PriceCheckResponse | null>(null);
  const [priceCheckLoading, setPriceCheckLoading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingItem, setLinkingItem] = useState<WishlistItem | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formStore, setFormStore] = useState("");
  const [formPriority, setFormPriority] = useState("3");
  const [formNotes, setFormNotes] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, goalsRes, dashRes] = await Promise.all([
        fetch("/api/wishlist"),
        fetch("/api/savings-goals"),
        fetch("/api/dashboard"),
      ]);
      const itemsData = await itemsRes.json();
      const goalsData = await goalsRes.json();
      setItems(itemsData);
      setGoals(goalsData);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        const savingsAcc = dashData.accountsSummary?.bankAccounts?.find(
          (a: { name: string }) => a.name.toLowerCase().includes("savings")
        );
        if (savingsAcc) {
          setSavingsBalance({ name: savingsAcc.name, balance: savingsAcc.balance });
        }
      }
    } catch {
      toast.error("Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setFormName("");
    setFormPrice("");
    setFormUrl("");
    setFormStore("");
    setFormPriority("3");
    setFormNotes("");
    setFormCategory("");
    setEditingItem(null);
  }

  function openEdit(item: WishlistItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(centsToDollars(item.price).toFixed(2));
    setFormUrl(item.url || "");
    setFormStore(item.store || "");
    setFormPriority(String(item.priority));
    setFormNotes(item.notes || "");
    setFormCategory(item.category || "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: formName,
      price: dollarsToCents(parseFloat(formPrice)),
      url: formUrl || null,
      store: formStore || null,
      priority: Number(formPriority),
      notes: formNotes || null,
      category: formCategory || null,
    };

    try {
      if (editingItem) {
        await fetch(`/api/wishlist/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Item updated");
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Item added to wishlist");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error("Failed to save item");
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
      toast.success("Item removed");
      fetchData();
    } catch {
      toast.error("Failed to delete item");
    }
  }

  async function handleStatusChange(id: number, status: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try {
      await fetch(`/api/wishlist/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          price: item.price,
          url: item.url,
          store: item.store,
          priority: item.priority,
          notes: item.notes,
          category: item.category,
          status,
        }),
      });
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
      fetchData();
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleLinkGoal() {
    if (!linkingItem) return;
    try {
      await fetch(`/api/wishlist/${linkingItem.id}/link-goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedGoalId === "new"
            ? {}
            : { existingGoalId: Number(selectedGoalId) }
        ),
      });
      toast.success("Savings goal linked");
      setLinkDialogOpen(false);
      setLinkingItem(null);
      setSelectedGoalId("");
      fetchData();
    } catch {
      toast.error("Failed to link goal");
    }
  }

  async function handleBnplAdvisor() {
    setBnplAdvisorLoading(true);
    setBnplAdvisor(null);
    try {
      const res = await fetch("/api/wishlist/bnpl-advisor", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyse");
      }
      const data = await res.json();
      setBnplAdvisor(data);
      toast.success("AI BNPL analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyse");
    } finally {
      setBnplAdvisorLoading(false);
    }
  }

  async function handlePriceCheck() {
    setPriceCheckLoading(true);
    setPriceCheck(null);
    try {
      const res = await fetch("/api/wishlist/price-check", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to check prices");
      }
      const data = await res.json();
      setPriceCheck(data);
      toast.success("Price check complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check prices");
    } finally {
      setPriceCheckLoading(false);
    }
  }

  // Filtered items
  const filteredItems =
    statusFilter === "all"
      ? items
      : items.filter((i) => i.status === statusFilter);

  // Summary stats
  const activeItems = items.filter(
    (i) => i.status === "wanted" || i.status === "saving"
  );
  const totalValue = activeItems.reduce((sum, i) => sum + i.price, 0);
  const purchasedCount = items.filter((i) => i.status === "purchased").length;

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
          <h1 className="text-3xl font-bold tracking-tight">Wishlist</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track everything you want and plan your purchases
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51] active:bg-[#b4e431]">
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/[0.08] bg-zinc-900">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Item" : "Add to Wishlist"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Item Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. AirPods Pro"
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="399.00"
                      className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Store</Label>
                    <Input
                      value={formStore}
                      onChange={(e) => setFormStore(e.target.value)}
                      placeholder="e.g. JB Hi-Fi"
                      className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">URL / Link</Label>
                  <Input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Priority</Label>
                    <Select value={formPriority} onValueChange={setFormPriority}>
                      <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Critical</SelectItem>
                        <SelectItem value="2">High</SelectItem>
                        <SelectItem value="3">Medium</SelectItem>
                        <SelectItem value="4">Low</SelectItem>
                        <SelectItem value="5">Someday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Category</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Notes</Label>
                  <Input
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Any extra details..."
                    className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-[#c4f441]/30"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51]">
                  {editingItem ? "Update Item" : "Add to Wishlist"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pink-500/[0.07] via-transparent to-violet-500/[0.04]" />
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-pink-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="relative grid gap-8 sm:grid-cols-3">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              Wishlist Value
            </div>
            <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-100">
              {formatMoney(totalValue)}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {activeItems.length} active {activeItems.length === 1 ? "item" : "items"}
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <Banknote className="h-3.5 w-3.5 text-emerald-400" />
              Savings Balance
            </div>
            {savingsBalance ? (
              <>
                <p className="mt-4 text-5xl font-bold tracking-tighter text-emerald-400">
                  {formatMoney(savingsBalance.balance)}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {savingsBalance.name}
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-600">
                  --
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  No savings account found
                </p>
              </>
            )}
          </div>

          <div className="text-center sm:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Purchased
            </div>
            <p className="mt-4 text-5xl font-bold tracking-tighter text-zinc-100">
              {purchasedCount}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {purchasedCount === 1 ? "item" : "items"} ticked off
            </p>
          </div>
        </div>
      </div>

      {/* AI BNPL Advisor */}
      <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[#c4f441]/20 to-[#c4f441]/5 p-2.5">
                <Bot className="h-5 w-5 text-[#c4f441]" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">AI BNPL Advisor</CardTitle>
                <CardDescription className="text-zinc-600">
                  Smart recommendations on what to buy and which BNPL provider to use
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bnplAdvisor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-zinc-600 hover:text-zinc-300"
                  onClick={() => setBnplAdvisor(null)}
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
              <Button
                onClick={handleBnplAdvisor}
                disabled={bnplAdvisorLoading || activeItems.length === 0}
                className="bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51] active:bg-[#b4e431]"
              >
                {bnplAdvisorLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {bnplAdvisor ? "Re-analyse" : "Analyse My Wishlist"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {bnplAdvisor && (
          <CardContent className="space-y-5">
            {/* BNPL Health Check */}
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#c4f441]" />
              <div>
                <p className="text-sm font-medium text-zinc-200">BNPL Health Check</p>
                <p className="mt-1 text-sm text-zinc-500">{bnplAdvisor.bnplHealthCheck}</p>
              </div>
            </div>

            {/* Overall Summary */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-sm leading-relaxed text-zinc-400">{bnplAdvisor.overallSummary}</p>
            </div>

            {/* Item Recommendations */}
            <div className="space-y-3">
              {bnplAdvisor.items.map((item) => {
                const style = RECOMMENDATION_STYLES[item.recommendation] || RECOMMENDATION_STYLES.wait;
                return (
                  <div
                    key={item.itemId}
                    className={`group relative overflow-hidden rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} p-5 transition-all hover:shadow-lg`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg bg-white/[0.06] p-2 ${style.icon}`}>
                            {RECOMMENDATION_ICONS[item.recommendation] || <DollarSign className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-100">{item.itemName}</p>
                            <p className="text-sm font-medium text-zinc-400">{formatMoney(Math.round(item.price * 100))}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className={`text-xs font-semibold ${item.canAfford ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"} border-0`}>
                            {item.canAfford ? "Can afford" : "Can't afford right now"}
                          </Badge>
                          <Badge variant="secondary" className={`text-xs font-semibold border-0 ${style.icon.replace("text-", "bg-").replace("400", "500/15")} ${style.icon}`}>
                            {style.label}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                          {item.reasoning}
                        </p>
                        {item.paymentBreakdown && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-500">
                            <CreditCard className="h-3 w-3" />
                            {item.paymentBreakdown}
                          </div>
                        )}
                        {item.warnings.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {item.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400/80">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/[0.02] blur-2xl transition-all group-hover:bg-white/[0.04]" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
        {!bnplAdvisor && !bnplAdvisorLoading && activeItems.length > 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-[#c4f441]/[0.06] p-3">
                <Bot className="h-5 w-5 text-[#c4f441]/50" />
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Click &quot;Analyse My Wishlist&quot; to get personalised BNPL recommendations
              </p>
              <div className="mt-3 flex gap-4 text-xs text-zinc-600">
                <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Afterpay</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Zip Pay</span>
                <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> Cash</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Price Check */}
      <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 p-2.5">
                <TrendingDown className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Price Tracker</CardTitle>
                <CardDescription className="text-zinc-600">
                  Scrape your wishlisted URLs for price drops &amp; sales
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {priceCheck && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-zinc-600 hover:text-zinc-300"
                  onClick={() => setPriceCheck(null)}
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
              <Button
                onClick={handlePriceCheck}
                disabled={priceCheckLoading || activeItems.filter((i) => i.url).length === 0}
                className="bg-orange-500 font-semibold text-white hover:bg-orange-400 active:bg-orange-600"
              >
                {priceCheckLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {priceCheck ? "Re-check" : "Check Prices"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {priceCheck && (
          <CardContent className="space-y-5">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-zinc-100">{priceCheck.summary.totalChecked}</p>
                <p className="text-xs text-zinc-600">Checked</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{priceCheck.summary.priceDrops}</p>
                <p className="text-xs text-emerald-400/60">Price Drops</p>
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-orange-400">{priceCheck.summary.onSale}</p>
                <p className="text-xs text-orange-400/60">On Sale</p>
              </div>
              {priceCheck.summary.totalSavings > 0 && (
                <div className="rounded-xl border border-[#c4f441]/20 bg-[#c4f441]/[0.04] p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-[#c4f441]">{formatMoney(priceCheck.summary.totalSavings)}</p>
                  <p className="text-xs text-[#c4f441]/60">Potential Savings</p>
                </div>
              )}
            </div>

            {/* Individual Results */}
            <div className="space-y-3">
              {priceCheck.results
                .sort((a, b) => a.priceDifference - b.priceDifference)
                .map((result) => {
                  const hasDrop = result.currentPrice !== null && result.priceDifference < 0;
                  const hasIncrease = result.currentPrice !== null && result.priceDifference > 0;
                  const isUnchanged = result.currentPrice !== null && result.priceDifference === 0;

                  return (
                    <div
                      key={result.itemId}
                      className={`group relative overflow-hidden rounded-xl border p-4 transition-all ${
                        result.error
                          ? "border-zinc-800 bg-zinc-900/40"
                          : hasDrop
                            ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5"
                            : result.onSale
                              ? "border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-600/5"
                              : hasIncrease
                                ? "border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-600/5"
                                : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-zinc-100">{result.itemName}</p>
                            {result.onSale && result.saleLabel && (
                              <Badge variant="secondary" className="border-0 bg-orange-500/15 text-xs font-semibold text-orange-400">
                                <Tag className="mr-1 h-3 w-3" />
                                {result.saleLabel}
                              </Badge>
                            )}
                          </div>
                          {result.error ? (
                            <p className="mt-1 text-sm text-zinc-600">{result.error}</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <span className="text-sm text-zinc-500">
                                Saved as {formatMoney(result.originalPrice)}
                              </span>
                              {result.currentPrice !== null && (
                                <>
                                  <span className="text-zinc-700">&rarr;</span>
                                  <span className={`text-sm font-semibold ${
                                    hasDrop ? "text-emerald-400" : hasIncrease ? "text-red-400" : "text-zinc-300"
                                  }`}>
                                    Now {formatMoney(result.currentPrice)}
                                  </span>
                                  {result.foreignCurrency && result.foreignPrice !== null && (
                                    <span className="text-xs text-zinc-600">
                                      ({CURRENCY_SYMBOLS[result.foreignCurrency] || result.foreignCurrency}{result.foreignPrice.toFixed(2)} {result.foreignCurrency} &rarr; AUD)
                                    </span>
                                  )}
                                  {!isUnchanged && (
                                    <Badge
                                      variant="secondary"
                                      className={`border-0 text-xs font-semibold ${
                                        hasDrop
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : "bg-red-500/15 text-red-400"
                                      }`}
                                    >
                                      {hasDrop ? (
                                        <ArrowDown className="mr-0.5 h-3 w-3" />
                                      ) : (
                                        <ArrowUp className="mr-0.5 h-3 w-3" />
                                      )}
                                      {Math.abs(result.percentChange)}%
                                    </Badge>
                                  )}
                                  {isUnchanged && (
                                    <Badge variant="secondary" className="border-0 bg-zinc-800 text-xs font-semibold text-zinc-500">
                                      <Minus className="mr-0.5 h-3 w-3" />
                                      No change
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })}
            </div>

            <p className="text-center text-xs text-zinc-700">
              Last checked {new Date(priceCheck.checkedAt).toLocaleString()}
            </p>
          </CardContent>
        )}
        {!priceCheck && !priceCheckLoading && activeItems.filter((i) => i.url).length > 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-orange-500/[0.06] p-3">
                <TrendingDown className="h-5 w-5 text-orange-500/50" />
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Scrape product pages to detect price changes and sales
              </p>
              <p className="mt-1 text-xs text-zinc-700">
                {activeItems.filter((i) => i.url).length} item{activeItems.filter((i) => i.url).length === 1 ? "" : "s"} with URLs to check
              </p>
            </div>
          </CardContent>
        )}
        {!priceCheck && !priceCheckLoading && activeItems.filter((i) => i.url).length === 0 && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="rounded-full bg-zinc-800 p-3">
                <LinkIcon className="h-5 w-5 text-zinc-600" />
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Add URLs to your wishlist items to enable price tracking
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "wanted", "saving", "purchased", "archived"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              statusFilter === status
                ? "bg-[#c4f441] text-zinc-900"
                : "border border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            {status === "all" ? "All" : STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {/* Item Cards */}
      {filteredItems.length === 0 ? (
        <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 rounded-full bg-pink-500/[0.06] p-4 w-fit">
              <Heart className="h-8 w-8 text-pink-400/50" />
            </div>
            <p className="text-lg font-medium text-zinc-300">
              {items.length === 0
                ? "Your wishlist is empty"
                : "No items match this filter"}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {items.length === 0
                ? "Add items you want to track and plan your purchases."
                : "Try a different filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredItems.map((item) => {
            const goalProgress =
              item.linkedGoalId && item.goalTargetAmount
                ? (item.goalCurrentAmount || 0) / item.goalTargetAmount
                : null;
            const isReadyToBuy =
              goalProgress !== null && goalProgress >= 1;

            return (
              <Card
                key={item.id}
                className={`group relative overflow-hidden border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm transition-all hover:shadow-lg ${
                  item.status === "purchased"
                    ? "border-emerald-500/20"
                    : isReadyToBuy
                      ? "border-emerald-500/20"
                      : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="text-zinc-100">{item.name}</span>
                        {isReadyToBuy && (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-xs font-semibold">
                            Ready to buy!
                          </Badge>
                        )}
                        {item.status === "purchased" && (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-xs font-semibold">
                            Purchased
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${PRIORITY_BADGE_STYLES[item.priority]}`}
                        >
                          {PRIORITY_LABELS[item.priority]}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${STATUS_BADGE_STYLES[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        {item.store && (
                          <span className="text-xs text-zinc-600">{item.store}</span>
                        )}
                        {item.category && (
                          <Badge variant="secondary" className="text-xs border-0 bg-zinc-800 text-zinc-500">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-lg font-bold tabular-nums tracking-tight text-zinc-100">
                      {formatMoney(item.price)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.notes && (
                    <p className="text-sm text-zinc-500">{item.notes}</p>
                  )}

                  {/* Linked Goal Progress */}
                  {item.linkedGoalId && item.goalName && (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 text-sm mb-1.5">
                        <Target className="h-3.5 w-3.5 text-amber-400" />
                        <span className="font-medium text-zinc-300">{item.goalName}</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-zinc-400">{formatMoney(item.goalCurrentAmount || 0)}</span>
                        <span className="text-zinc-600">
                          {formatMoney(item.goalTargetAmount || item.price)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (goalProgress || 0) >= 1 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min((goalProgress || 0) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* BNPL Estimates */}
                  {(item.status === "wanted" || item.status === "saving") && (
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">Afterpay</p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">
                          4 x {formatMoney(Math.ceil(item.price / 4))}
                        </p>
                      </div>
                      <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">Zip Pay</p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">
                          ~{formatMoney(Math.max(4000, Math.ceil(item.price * 0.03)))}/mo
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </a>
                    )}
                    {(item.status === "wanted" || item.status === "saving") && (
                      <>
                        <Link
                          href={`/purchase?item=${encodeURIComponent(item.name)}&price=${centsToDollars(item.price).toFixed(2)}&store=${encodeURIComponent(item.store || "")}`}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                          >
                            <ShoppingBag className="h-3 w-3 mr-1" />
                            Can I afford this?
                          </Button>
                        </Link>
                        {!item.linkedGoalId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                            onClick={() => {
                              setLinkingItem(item);
                              setSelectedGoalId("new");
                              setLinkDialogOpen(true);
                            }}
                          >
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Link Goal
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-500/20 bg-emerald-500/[0.06] text-xs text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => handleStatusChange(item.id, "purchased")}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Bought
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/[0.08] bg-white/[0.03] text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                          onClick={() => handleStatusChange(item.id, "archived")}
                        >
                          <Archive className="h-3 w-3 mr-1" />
                          Archive
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-600 hover:text-zinc-300"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-600 hover:text-red-400"
                      onClick={() => handleDelete(item.id)}
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

      {/* Link Goal Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Link Savings Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Link a savings goal to{" "}
              <span className="font-medium text-zinc-300">{linkingItem?.name}</span> (
              {linkingItem ? formatMoney(linkingItem.price) : ""})
            </p>
            <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
              <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
                <SelectValue placeholder="Choose an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  Create new goal (auto-filled)
                </SelectItem>
                {goals
                  .filter((g) => g.currentAmount < g.targetAmount)
                  .map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name} ({formatMoney(g.targetAmount - g.currentAmount)}{" "}
                      remaining)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleLinkGoal}
              disabled={!selectedGoalId}
              className="w-full bg-[#c4f441] font-semibold text-zinc-900 hover:bg-[#d4ff51]"
            >
              Link Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
