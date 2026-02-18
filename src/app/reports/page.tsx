"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  FileText, TrendingUp, TrendingDown, AlertTriangle,
  Lightbulb, Activity, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ReportData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  categoryTotals: Record<string, number>;
  bnplExposure: number;
  report: {
    summary: string;
    highlights: string[];
    anomalies: string[];
    suggestions: string[];
    healthScore: number;
  } | null;
  message?: string;
}

const CHART_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48",
];

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

function HealthScoreGauge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-green-500" :
    score >= 40 ? "text-amber-500" :
    "text-red-500";
  const label =
    score >= 70 ? "Healthy" :
    score >= 40 ? "Needs Attention" :
    "At Risk";

  return (
    <div className="flex flex-col items-center">
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <p className="text-sm text-muted-foreground mt-1">out of 100</p>
      <Badge variant="outline" className={`mt-2 ${color}`}>
        {label}
      </Badge>
    </div>
  );
}

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedMonths, setGeneratedMonths] = useState<Set<string>>(new Set());

  const monthOptions = getMonthOptions();

  async function generateReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?month=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      setReportData(data);
      setGeneratedMonths((prev) => new Set([...prev, selectedMonth]));
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function navigateMonth(direction: -1 | 1) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
    setReportData(null);
  }

  // Prepare chart data
  const categoryChartData = reportData
    ? Object.entries(reportData.categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({
          category,
          amount: amount / 100,
        }))
    : [];

  const pieData = categoryChartData.map((item, idx) => ({
    ...item,
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  const incomeVsExpenses = reportData
    ? [
        { name: "Income", amount: reportData.totalIncome / 100 },
        { name: "Expenses", amount: reportData.totalExpenses / 100 },
        { name: "Saved", amount: Math.max(0, (reportData.totalIncome - reportData.totalExpenses) / 100) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monthly Reports</h1>
        <p className="text-muted-foreground">
          AI-powered analysis of your monthly spending
        </p>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setReportData(null); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {opt.label}
                      {generatedMonths.has(opt.value) && (
                        <Badge variant="secondary" className="text-xs">Generated</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={generateReport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {!reportData && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Select a month and generate a report</p>
            <p className="text-muted-foreground">
              Reports are generated from your transaction data using AI analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {reportData && (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  Income
                </CardDescription>
                <CardTitle className="text-2xl text-green-500">
                  {formatMoney(reportData.totalIncome)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  Expenses
                </CardDescription>
                <CardTitle className="text-2xl text-red-500">
                  {formatMoney(reportData.totalExpenses)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Savings Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {reportData.savingsRate.toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress
                  value={Math.max(0, Math.min(100, reportData.savingsRate))}
                  className="h-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  BNPL Exposure
                </CardDescription>
                <CardTitle className="text-2xl text-amber-500">
                  {formatMoney(reportData.bnplExposure)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={incomeVsExpenses}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Amount"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {incomeVsExpenses.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={idx === 0 ? "#10b981" : idx === 1 ? "#ef4444" : "#3b82f6"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        fontSize={11}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Amount"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No spending data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryChartData.map((item, idx) => {
                  const maxAmount = categoryChartData[0]?.amount || 1;
                  const barWidth = (item.amount / maxAmount) * 100;
                  return (
                    <div key={item.category} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="w-32 text-sm truncate">{item.category}</span>
                      <div className="flex-1">
                        <div
                          className="h-4 rounded"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-24 text-right">
                        {formatMoney(item.amount * 100)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Report */}
          {reportData.report ? (
            <>
              {/* Health Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Financial Health Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-4">
                  <HealthScoreGauge score={reportData.report.healthScore} />
                </CardContent>
              </Card>

              {/* AI Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Monthly Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {reportData.report.summary}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Highlights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Highlights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reportData.report.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Anomalies */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Anomalies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reportData.report.anomalies.length > 0 ? (
                      <ul className="space-y-2">
                        {reportData.report.anomalies.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nothing unusual this month</p>
                    )}
                  </CardContent>
                </Card>

                {/* Suggestions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lightbulb className="h-4 w-4 text-blue-500" />
                      Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reportData.report.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            reportData.message && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{reportData.message}</p>
                </CardContent>
              </Card>
            )
          )}
        </>
      )}
    </div>
  );
}
