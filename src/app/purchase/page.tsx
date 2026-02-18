"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, dollarsToCents } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ShoppingBag,
  Sparkles,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PaymentScheduleItem {
  date: string;
  amount: number;
  label: string;
}

interface Strategy {
  name: string;
  provider: string;
  available: boolean;
  reason?: string;
  totalCost: number;
  totalFees: number;
  schedule: PaymentScheduleItem[];
  cashflowProjection: { date: string; balance: number }[];
  minBalance: number;
  savingsImpact: number;
  score: number;
}

interface GeminiAdvice {
  recommendation: string;
  reasoning: string;
  bestStrategy: string;
  risks: string[];
  tips: string[];
}

interface AdvisorResult {
  item: string;
  price: number;
  strategies: Strategy[];
  baseProjection: { date: string; balance: number }[];
  geminiAdvice: GeminiAdvice | null;
}

function formatChartDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatChartMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-500"
      : score >= 40
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-mono w-8 text-right">{score}</span>
    </div>
  );
}

function CashflowChart({
  data,
  baseData,
}: {
  data: { date: string; balance: number }[];
  baseData: { date: string; balance: number }[];
}) {
  // Sample data to reduce chart density - pick every 3rd day
  const sampled = data.filter((_, i) => i % 3 === 0 || i === data.length - 1);
  const baseSampled = baseData.filter(
    (_, i) => i % 3 === 0 || i === baseData.length - 1
  );

  const merged = sampled.map((d, i) => ({
    date: formatChartDate(d.date),
    withPurchase: d.balance,
    baseline: baseSampled[i]?.balance ?? d.balance,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={merged}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={formatChartMoney}
          tick={{ fontSize: 10 }}
          width={50}
        />
        <RechartsTooltip
          formatter={(value) => formatMoney(value as number)}
          labelFormatter={(label) => `Date: ${label}`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 4"
          strokeWidth={1}
          dot={false}
          name="Without purchase"
        />
        <Line
          type="monotone"
          dataKey="withPurchase"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="With purchase"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StrategyCard({
  strategy,
  rank,
  isGeminiPick,
  baseProjection,
  defaultExpanded,
}: {
  strategy: Strategy;
  rank: number;
  isGeminiPick: boolean;
  baseProjection: { date: string; balance: number }[];
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      className={`relative ${
        isGeminiPick
          ? "border-primary ring-1 ring-primary/20"
          : strategy.available
            ? ""
            : "opacity-50"
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
              {rank}
            </span>
            <div>
              <CardTitle className="flex items-center gap-2">
                {strategy.name}
                {isGeminiPick && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Pick
                  </Badge>
                )}
                {!strategy.available && (
                  <Badge variant="secondary">Unavailable</Badge>
                )}
              </CardTitle>
              {strategy.reason && (
                <CardDescription>{strategy.reason}</CardDescription>
              )}
            </div>
          </div>
          {strategy.available && (
            <div className="text-right">
              <div className="text-lg font-bold">
                {formatMoney(strategy.totalCost)}
              </div>
              {strategy.totalFees > 0 && (
                <div className="text-xs text-destructive">
                  +{formatMoney(strategy.totalFees)} fees/interest
                </div>
              )}
              {strategy.totalFees === 0 && (
                <div className="text-xs text-green-500">No extra cost</div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      {strategy.available && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">Total Cost</div>
                <div className="font-medium">
                  {formatMoney(strategy.totalCost)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">Min Balance</div>
                <div
                  className={`font-medium ${strategy.minBalance < 0 ? "text-destructive" : ""}`}
                >
                  {formatMoney(strategy.minBalance)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">Payments</div>
                <div className="font-medium">{strategy.schedule.length}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">
              Strategy Score
            </div>
            <ScoreBar score={strategy.score} />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> Show Details
              </>
            )}
          </Button>

          {expanded && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">
                  Cashflow Projection (8 weeks)
                </div>
                <CashflowChart
                  data={strategy.cashflowProjection}
                  baseData={baseProjection}
                />
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Payment Schedule</div>
                <div className="space-y-1.5">
                  {strategy.schedule.map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm py-1.5 px-3 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(s.date).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <span className="font-mono">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PurchasePageContent() {
  const searchParams = useSearchParams();
  const [item, setItem] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [store, setStore] = useState("");
  const [urgency, setUrgency] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const itemParam = searchParams.get("item");
    const priceParam = searchParams.get("price");
    const storeParam = searchParams.get("store");
    if (itemParam) setItem(itemParam);
    if (priceParam) setPriceStr(priceParam);
    if (storeParam) setStore(storeParam);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceDollars = parseFloat(priceStr);
    if (!item.trim() || isNaN(priceDollars) || priceDollars <= 0) {
      setError("Please enter a valid item name and price.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/purchase-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: store ? `${item} from ${store}` : item,
          price: dollarsToCents(priceDollars),
          urgency: urgency || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Advisor</h1>
        <p className="text-muted-foreground">
          Should you buy it? Find the best way to pay based on your actual
          cashflow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            What do you want to buy?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item">Item Name</Label>
                <Input
                  id="item"
                  placeholder="e.g. AirPods Pro"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 399.00"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store">Store / Retailer (optional)</Label>
                <Input
                  id="store"
                  placeholder="e.g. JB Hi-Fi"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Urgency (optional)</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="How urgently?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="need_now">Need it now</SelectItem>
                    <SelectItem value="can_wait">Can wait</SelectItem>
                    <SelectItem value="just_exploring">
                      Just exploring
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyse Purchase
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          {/* Gemini AI Recommendation */}
          {result.geminiAdvice && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg font-medium">
                  {result.geminiAdvice.recommendation}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {result.geminiAdvice.reasoning}
                </p>
                {result.geminiAdvice.risks.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Risks
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {result.geminiAdvice.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">-</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.geminiAdvice.tips.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      Tips
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {result.geminiAdvice.tips.map((t, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">-</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Strategy Cards */}
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Payment Strategies ({result.strategies.filter((s) => s.available).length}{" "}
              available)
            </h2>
            <div className="space-y-4">
              {result.strategies.map((strategy, i) => (
                <StrategyCard
                  key={`${strategy.provider}-${strategy.name}-${i}`}
                  strategy={strategy}
                  rank={i + 1}
                  isGeminiPick={
                    result.geminiAdvice?.bestStrategy === strategy.name
                  }
                  baseProjection={result.baseProjection}
                  defaultExpanded={i === 0 && strategy.available}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchasePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <PurchasePageContent />
    </Suspense>
  );
}
