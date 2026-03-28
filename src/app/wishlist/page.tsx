"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
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
  Target,
  Loader2,
  Archive,
  CheckCircle2,
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
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

const GoalsPage = dynamic(() => import("@/app/goals/page"), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
    </div>
  ),
});
const BnplPage = dynamic(() => import("@/app/bnpl/page"), {
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
    </div>
  ),
});

type PlansTab = "wishlist" | "goals" | "bnpl";

const PLANS_TABS: { id: PlansTab; label: string; icon: React.ElementType; accent: string }[] = [
  { id: "wishlist", label: "Wishlist", icon: Heart, accent: "text-pink-400" },
  { id: "goals", label: "Goals", icon: Target, accent: "text-emerald-400" },
  { id: "bnpl", label: "BNPL", icon: CreditCard, accent: "text-orange-400" },
];

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
  1: "P1",
  2: "P2",
  3: "P3",
};

const PRIORITY_BADGE_STYLES: Record<number, string> = {
  1: "bg-red-500/15 text-red-400 border-0",
  2: "bg-orange-500/15 text-orange-400 border-0",
  3: "bg-amber-500/15 text-amber-400 border-0",
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

function WishlistContent({ addOpen, onAddOpenChange }: { addOpen?: boolean; onAddOpenChange?: (open: boolean) => void }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpenInternal, setDialogOpenInternal] = useState(false);
  const dialogOpen = addOpen ?? dialogOpenInternal;
  const setDialogOpen = (open: boolean) => {
    setDialogOpenInternal(open);
    onAddOpenChange?.(open);
  };
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingsBalance, setSavingsBalance] = useState<{ name: string; balance: number } | null>(null);
  const [bnplAdvisor, setBnplAdvisor] = useState<BnplAdvisorResult | null>(null);
  const [bnplAdvisorLoading, setBnplAdvisorLoading] = useState(false);
  const [priceCheck, setPriceCheck] = useState<PriceCheckResponse | null>(null);
  const [priceCheckLoading, setPriceCheckLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);


  // Form state
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formStore, setFormStore] = useState("");
  const [formPriority, setFormPriority] = useState("2");
  const [formNotes, setFormNotes] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, goalsRes, dashRes] = await Promise.all([
        fetch("/api/wishlist"),
        fetch("/api/savings-goals"),
        fetch("/api/dashboard"),
      ]);
      const itemsData: WishlistItem[] = await itemsRes.json();
      const goalsData = await goalsRes.json();

      // Auto-delete purchased items older than 2 days
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const expiredPurchased = itemsData.filter(
        (i) =>
          i.status === "purchased" &&
          i.datePurchased &&
          new Date(i.datePurchased).getTime() < twoDaysAgo
      );
      for (const item of expiredPurchased) {
        fetch(`/api/wishlist/${item.id}`, { method: "DELETE" }).catch(() => {});
      }
      const remainingItems = expiredPurchased.length > 0
        ? itemsData.filter((i) => !expiredPurchased.some((e) => e.id === i.id))
        : itemsData;

      setItems(remainingItems);
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
    setFormPriority("2");
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
      : statusFilter === "p1"
        ? items.filter((i) => i.priority === 1 && i.status !== "purchased")
        : statusFilter === "p2"
          ? items.filter((i) => i.priority === 2 && i.status !== "purchased")
          : statusFilter === "p3"
            ? items.filter((i) => i.priority === 3 && i.status !== "purchased")
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
    <div className="space-y-6 pb-8">
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
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
                      <SelectItem value="1">P1 — Must have</SelectItem>
                      <SelectItem value="2">P2 — Nice to have</SelectItem>
                      <SelectItem value="3">P3 — Someday</SelectItem>
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

      {/* Hero Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-pink-500/10 p-2.5">
              <Heart className="h-5 w-5 text-pink-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Wishlist Value</p>
              <p className="text-2xl font-bold tracking-tight text-zinc-100">
                {formatMoney(totalValue)}
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-500">
            {activeItems.length} {activeItems.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>
      </Dialog>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { key: "all", label: "All" },
          { key: "p1", label: "P1" },
          { key: "p2", label: "P2" },
          { key: "p3", label: "P3" },
          { key: "purchased", label: "Purchased" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              statusFilter === tab.key
                ? "bg-[#c4f441] text-zinc-900"
                : "border border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            {tab.label}
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
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const goalProgress =
              item.linkedGoalId && item.goalTargetAmount
                ? (item.goalCurrentAmount || 0) / item.goalTargetAmount
                : null;
            const isReadyToBuy =
              goalProgress !== null && goalProgress >= 1;

            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3.5 text-left backdrop-blur-sm transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{item.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-semibold px-1.5 py-0 ${STATUS_BADGE_STYLES[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-semibold px-1.5 py-0 ${PRIORITY_BADGE_STYLES[item.priority]}`}
                    >
                      {PRIORITY_LABELS[item.priority]}
                    </Badge>
                    {item.category && (
                      <span className="text-[10px] text-zinc-600">{item.category}</span>
                    )}
                    {isReadyToBuy && (
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-[10px] font-semibold px-1.5 py-0">
                        Ready!
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="ml-3 shrink-0 text-sm font-bold tabular-nums text-zinc-100">
                  {formatMoney(item.price)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        {selectedItem && (() => {
          const goalProgress =
            selectedItem.linkedGoalId && selectedItem.goalTargetAmount
              ? (selectedItem.goalCurrentAmount || 0) / selectedItem.goalTargetAmount
              : null;
          const isReadyToBuy =
            goalProgress !== null && goalProgress >= 1;

          return (
            <DialogContent className="border-white/[0.08] bg-zinc-900 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg text-zinc-100">{selectedItem.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold ${STATUS_BADGE_STYLES[selectedItem.status]}`}
                  >
                    {STATUS_LABELS[selectedItem.status]}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs font-semibold ${PRIORITY_BADGE_STYLES[selectedItem.priority]}`}
                  >
                    {PRIORITY_LABELS[selectedItem.priority]}
                  </Badge>
                  {selectedItem.category && (
                    <Badge variant="secondary" className="text-xs border-0 bg-zinc-800 text-zinc-500">
                      {selectedItem.category}
                    </Badge>
                  )}
                  {selectedItem.store && (
                    <Badge variant="secondary" className="text-xs border-0 bg-zinc-800 text-zinc-500">
                      {selectedItem.store}
                    </Badge>
                  )}
                  {isReadyToBuy && (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-xs font-semibold">
                      Ready to buy!
                    </Badge>
                  )}
                  {selectedItem.status === "purchased" && (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-xs font-semibold">
                      Purchased
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
                  {formatMoney(selectedItem.price)}
                </p>

                {/* Notes */}
                {selectedItem.notes && (
                  <p className="text-sm text-zinc-500">{selectedItem.notes}</p>
                )}

                {/* Linked Goal Progress */}
                {selectedItem.linkedGoalId && selectedItem.goalName && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 text-sm mb-1.5">
                      <Target className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="font-medium text-zinc-300 truncate">{selectedItem.goalName}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">{formatMoney(selectedItem.goalCurrentAmount || 0)}</span>
                      <span className="text-zinc-600">
                        {formatMoney(selectedItem.goalTargetAmount || selectedItem.price)}
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
                {(selectedItem.status === "wanted" || selectedItem.status === "saving") && (
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">Afterpay</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">
                        4 × {formatMoney(Math.ceil(selectedItem.price / 4))}
                      </p>
                    </div>
                    <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">Zip Pay</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-400">
                        ~{formatMoney(Math.max(4000, Math.ceil(selectedItem.price * 0.03)))}/mo
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {selectedItem.url && (
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button
                        variant="outline"
                        className="w-full border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Listing
                      </Button>
                    </a>
                  )}
                  {(selectedItem.status === "wanted" || selectedItem.status === "saving") && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/[0.12] hover:text-emerald-300"
                        onClick={() => {
                          handleStatusChange(selectedItem.id, "purchased");
                          setSelectedItem(null);
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark as Bought
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                        onClick={() => {
                          handleStatusChange(selectedItem.id, "archived");
                          setSelectedItem(null);
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    </div>
                  )}
                  {selectedItem.status === "archived" && (
                    <Button
                      variant="outline"
                      className="w-full border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                      onClick={() => {
                        handleStatusChange(selectedItem.id, "wanted");
                        setSelectedItem(null);
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Unarchive
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                      onClick={() => {
                        openEdit(selectedItem);
                        setSelectedItem(null);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-500/20 bg-red-500/[0.06] text-red-400 hover:bg-red-500/[0.12] hover:text-red-300"
                      onClick={() => {
                        handleDelete(selectedItem.id);
                        setSelectedItem(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>


    </div>
  );
}

export default function PlansPage() {
  const [activeTab, setActiveTab] = useState<PlansTab>("wishlist");
  const [fabOpen, setFabOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState<PlansTab | null>(null);

  function handleFabChoice(tab: PlansTab) {
    setFabOpen(false);
    setActiveTab(tab);
    // Small delay so the tab content mounts before opening dialog
    setTimeout(() => setAddDialogOpen(tab), 50);
  }

  return (
    <div className="relative space-y-6 pb-8">
      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-1 backdrop-blur-sm max-w-sm">
        {PLANS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/[0.08] text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400"
              }`}
            >
              <tab.icon
                className={`h-3.5 w-3.5 ${isActive ? tab.accent : ""}`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "wishlist" && (
        <WishlistContent
          addOpen={addDialogOpen === "wishlist" ? true : undefined}
          onAddOpenChange={(open) => { if (!open) setAddDialogOpen(null); }}
        />
      )}
      {activeTab === "goals" && (
        <GoalsPage
          addOpen={addDialogOpen === "goals" ? true : undefined}
          onAddOpenChange={(open) => { if (!open) setAddDialogOpen(null); }}
        />
      )}
      {activeTab === "bnpl" && (
        <BnplPage
          addOpen={addDialogOpen === "bnpl" ? true : undefined}
          onAddOpenChange={(open) => { if (!open) setAddDialogOpen(null); }}
        />
      )}

      {/* FAB Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB Menu */}
      {fabOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
          {[
            { tab: "wishlist" as PlansTab, label: "Wishlist Item", icon: Heart },
            { tab: "goals" as PlansTab, label: "Savings Goal", icon: Target },
            { tab: "bnpl" as PlansTab, label: "BNPL Plan", icon: CreditCard },
          ].map((opt) => (
            <button
              key={opt.tab}
              onClick={() => handleFabChoice(opt.tab)}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-xl backdrop-blur-md transition-all hover:bg-zinc-800"
            >
              <opt.icon className="h-4 w-4 text-[#c4f441]" />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setFabOpen((prev) => !prev)}
        className={`fixed bottom-8 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#c4f441] text-zinc-900 shadow-lg transition-all hover:bg-[#d4ff51] active:bg-[#b4e431] ${
          fabOpen ? "rotate-45" : ""
        }`}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
