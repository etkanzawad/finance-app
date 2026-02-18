"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  Upload,
  AlertTriangle,
  Loader2,
  FileText,
  Check,
  Pencil,
  Search,
  BarChart3,
  List,
} from "lucide-react";

// ---- Statements Section ----

const CATEGORIES = [
  "Groceries", "Dining", "Transport", "Entertainment", "Shopping",
  "Health", "Utilities", "Rent/Housing", "Subscriptions", "Insurance",
  "Transfers", "Income", "Cash Withdrawal", "Fees", "Other",
];

const CATEGORY_COLOURS: Record<string, string> = {
  Groceries: "hsl(142, 71%, 45%)", Dining: "hsl(25, 95%, 53%)",
  Transport: "hsl(217, 91%, 60%)", Entertainment: "hsl(271, 91%, 65%)",
  Shopping: "hsl(340, 82%, 52%)", Health: "hsl(174, 72%, 46%)",
  Utilities: "hsl(48, 96%, 53%)", "Rent/Housing": "hsl(199, 89%, 48%)",
  Subscriptions: "hsl(292, 84%, 61%)", Insurance: "hsl(162, 73%, 46%)",
  Transfers: "hsl(215, 20%, 65%)", Income: "hsl(142, 76%, 36%)",
  "Cash Withdrawal": "hsl(0, 0%, 60%)", Fees: "hsl(0, 84%, 60%)",
  Other: "hsl(215, 14%, 54%)",
};

interface ParsedTx {
  date: string;
  rawDescription: string;
  amount: number;
  balanceAfter?: number;
  statementMonth: string;
}

interface ReviewTx {
  accountId: number;
  date: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  balanceAfter: number | null;
  category: string;
  isIncome: boolean;
  isReviewed: boolean;
  statementMonth: string;
}

interface SavedTx extends ReviewTx {
  id: number;
  createdAt: string;
}

interface StmtAccount {
  id: number;
  name: string;
  type: string;
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function parseNabCsv(csvData: string[][]): ParsedTx[] {
  const transactions: ParsedTx[] = [];
  for (const row of csvData) {
    if (row.length < 3) continue;
    let date = "";
    let description = "";
    let amount = 0;
    let balance: number | undefined;
    const dateStr = row[0]?.trim();
    if (!dateStr || !/\d/.test(dateStr)) continue;
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!dateMatch) continue;
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    date = `${year}-${month}-${day}`;
    if (row.length >= 5) {
      const col2 = row[2]?.trim();
      const col3 = row[3]?.trim();
      const isDebitCreditFormat =
        (col2 === "" || /^-?[\d,]+\.?\d*$/.test(col2.replace(/[,$]/g, ""))) &&
        (col3 === "" || /^-?[\d,]+\.?\d*$/.test(col3.replace(/[,$]/g, "")));
      if (isDebitCreditFormat && isNaN(Number(row[1]?.replace(/[,$]/g, "")))) {
        description = row[1]?.trim() || "";
        const debit = parseFloat(col2.replace(/[,$]/g, "")) || 0;
        const credit = parseFloat(col3.replace(/[,$]/g, "")) || 0;
        amount = credit > 0 ? Math.round(credit * 100) : -Math.round(debit * 100);
        const balStr = row[4]?.trim().replace(/[,$]/g, "");
        if (balStr) balance = Math.round(parseFloat(balStr) * 100);
      } else {
        const amtStr = row[1]?.trim().replace(/[,$]/g, "");
        amount = Math.round(parseFloat(amtStr) * 100);
        description = row[2]?.trim() || "";
        const balStr = row[3]?.trim().replace(/[,$]/g, "");
        if (balStr && !isNaN(parseFloat(balStr))) balance = Math.round(parseFloat(balStr) * 100);
      }
    } else {
      const amtStr = row[1]?.trim().replace(/[,$]/g, "");
      amount = Math.round(parseFloat(amtStr) * 100);
      description = row[2]?.trim() || "";
      if (row[3]) {
        const balStr = row[3]?.trim().replace(/[,$]/g, "");
        if (balStr && !isNaN(parseFloat(balStr))) balance = Math.round(parseFloat(balStr) * 100);
      }
    }
    if (!description || isNaN(amount)) continue;
    const statementMonth = `${year}-${month}`;
    transactions.push({ date, rawDescription: description, amount, balanceAfter: balance, statementMonth });
  }
  return transactions;
}

type StmtView = "upload" | "review" | "list" | "chart";

export default function StatementsSection() {
  const [accounts, setAccounts] = useState<StmtAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [activeView, setActiveView] = useState<StmtView>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTx[]>([]);
  const [importing, setImporting] = useState(false);
  const [reviewTransactions, setReviewTransactions] = useState<ReviewTx[]>([]);
  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([]);
  const [importStats, setImportStats] = useState<{ total: number; categorised: number; fromMappings: number; fromAI: number } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editCleanName, setEditCleanName] = useState("");
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<SavedTx[]>([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setAccounts(data); })
      .catch(() => {});
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadingTxns(true);
    const params = new URLSearchParams();
    if (filterMonth && filterMonth !== "all") params.set("month", filterMonth);
    if (filterCategory && filterCategory !== "all") params.set("category", filterCategory);
    if (filterAccount && filterAccount !== "all") params.set("accountId", filterAccount);
    if (searchQuery) params.set("search", searchQuery);
    try {
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setTransactions(data);
    } catch { toast.error("Failed to load transactions"); }
    setLoadingTxns(false);
  }, [filterMonth, filterCategory, filterAccount, searchQuery]);

  useEffect(() => {
    if (activeView !== "list" && activeView !== "chart") return;
    loadTransactions();
  }, [activeView, loadTransactions]);

  const handlePdfFile = useCallback(async (file: File) => {
    setParsingPdf(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/statements/parse-pdf", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to parse PDF"); }
      const data = await res.json();
      setParsedTransactions(data.transactions);
      toast.success(`Parsed ${data.transactions.length} transactions from PDF`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse PDF statement");
    } finally {
      setParsingPdf(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
    const isCsv = lower.endsWith(".csv") || file.type === "text/csv";
    if (!isPdf && !isCsv) { toast.error("Please upload a CSV or PDF file"); return; }
    if (isPdf) { handlePdfFile(file); return; }
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        const filtered = data.filter((row) => {
          if (row.length < 3) return false;
          const first = row[0]?.trim();
          return first && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(first);
        });
        const parsed = parseNabCsv(filtered);
        if (parsed.length === 0) { toast.error("No transactions found in CSV"); return; }
        setParsedTransactions(parsed);
        toast.success(`Parsed ${parsed.length} transactions`);
      },
      error: () => { toast.error("Failed to parse CSV file"); },
    });
  }, [handlePdfFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  async function handleImport() {
    if (!selectedAccount) { toast.error("Please select an account first"); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: parsedTransactions, accountId: Number(selectedAccount) }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Import failed"); }
      const data = await res.json();
      setReviewTransactions(data.transactions);
      setDuplicateIndices(data.duplicates || []);
      setImportStats({ total: data.total, categorised: data.categorised, fromMappings: data.fromMappings, fromAI: data.fromAI });
      setActiveView("review");
      toast.success(`Categorised ${data.total} transactions (${data.fromMappings} from saved mappings)`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); }
    setImporting(false);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditCategory(reviewTransactions[index].category);
    setEditCleanName(reviewTransactions[index].cleanDescription);
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const updated = [...reviewTransactions];
    updated[editingIndex] = { ...updated[editingIndex], category: editCategory, cleanDescription: editCleanName, isReviewed: true };
    setReviewTransactions(updated);
    setEditingIndex(null);
  }

  function approveAll() {
    setReviewTransactions((prev) => prev.map((tx) => ({ ...tx, isReviewed: true })));
  }

  async function saveTransactions() {
    setSaving(true);
    const toSave = reviewTransactions.filter((_, i) => !duplicateIndices.includes(i));
    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: toSave }),
      });
      if (!res.ok) throw new Error("Save failed");
      const editedMappings = toSave
        .filter((tx) => tx.isReviewed)
        .map((tx) => ({ rawPattern: tx.rawDescription.toLowerCase().replace(/\d/g, "").trim().slice(0, 30), cleanName: tx.cleanDescription, category: tx.category }))
        .filter((m, i, arr) => m.rawPattern.length > 3 && arr.findIndex((x) => x.rawPattern === m.rawPattern) === i);
      if (editedMappings.length > 0) {
        await fetch("/api/categorise", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mappings: editedMappings }) });
      }
      const data = await res.json();
      toast.success(`Saved ${data.inserted} transactions${duplicateIndices.length > 0 ? ` (${duplicateIndices.length} duplicates skipped)` : ""}`);
      setReviewTransactions([]); setParsedTransactions([]); setImportStats(null);
      setActiveView("list"); loadTransactions();
    } catch { toast.error("Failed to save transactions"); }
    setSaving(false);
  }

  const chartData = CATEGORIES.filter((cat) => cat !== "Income" && cat !== "Transfers")
    .map((category) => ({
      category,
      total: transactions.filter((tx) => tx.category === category && tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const availableMonths = Array.from(new Set(transactions.map((tx) => tx.statementMonth).filter(Boolean))).sort().reverse();

  const STMT_VIEWS: { id: StmtView; label: string; icon: React.ElementType; disabled?: boolean }[] = [
    { id: "upload", label: "Import", icon: Upload },
    { id: "review", label: "Review", icon: Check, disabled: reviewTransactions.length === 0 },
    { id: "list", label: "Transactions", icon: List },
    { id: "chart", label: "Spending", icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex gap-1 rounded-lg border border-white/[0.04] bg-white/[0.02] p-1">
        {STMT_VIEWS.map((v) => {
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => !v.disabled && setActiveView(v.id)}
              disabled={v.disabled}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                v.disabled ? "cursor-not-allowed text-zinc-700" : isActive ? "bg-white/[0.06] text-zinc-200" : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
              {v.id === "review" && reviewTransactions.length > 0 && (
                <Badge variant="secondary" className="ml-1 border-0 bg-sky-500/15 text-sky-400 text-xs px-1.5">
                  {reviewTransactions.length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* UPLOAD */}
      {activeView === "upload" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
              <div className="rounded-lg bg-sky-500/10 p-1.5">
                <FileText className="h-3.5 w-3.5 text-sky-400" />
              </div>
              Select Account
            </div>
            <div className="mt-3">
              {accounts.length > 0 ? (
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="max-w-xs border-white/[0.08] bg-white/[0.03]">
                    <SelectValue placeholder="Choose account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>{acc.name} ({acc.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-zinc-600">No accounts found. Add accounts in Profile first.</p>
              )}
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !parsingPdf && fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              parsingPdf ? "cursor-not-allowed opacity-60 border-white/[0.08]" : dragOver ? "cursor-pointer border-sky-500/50 bg-sky-500/[0.04]" : "cursor-pointer border-white/[0.08] hover:border-white/[0.15]"
            }`}
          >
            {parsingPdf ? (
              <>
                <Loader2 className="mx-auto mb-4 h-10 w-10 text-sky-400 animate-spin" />
                <p className="text-base font-medium text-zinc-300">Parsing PDF with Gemini...</p>
                <p className="mt-1 text-sm text-zinc-600">This may take a moment.</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
                <p className="text-base font-medium text-zinc-300">Drop your bank statement here</p>
                <p className="mt-1 text-sm text-zinc-600">or click to browse. Supports CSV and PDF formats.</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="hidden" onChange={handleFileInput} />
          </div>

          {parsedTransactions.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-zinc-300">Parsed {parsedTransactions.length} Transactions</p>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-white/[0.06]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06]">
                      <TableHead className="text-zinc-500">Date</TableHead>
                      <TableHead className="text-zinc-500">Description</TableHead>
                      <TableHead className="text-right text-zinc-500">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.slice(0, 20).map((tx, i) => (
                      <TableRow key={i} className="border-white/[0.04]">
                        <TableCell className="whitespace-nowrap text-sm text-zinc-400">{fmtDate(tx.date)}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-zinc-400">{tx.rawDescription}</TableCell>
                        <TableCell className={`text-right whitespace-nowrap text-sm ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCents(tx.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedTransactions.length > 20 && (
                  <p className="p-2 text-center text-xs text-zinc-600">... and {parsedTransactions.length - 20} more</p>
                )}
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || !selectedAccount}
                className="mt-4 w-full bg-sky-500 font-medium text-white hover:bg-sky-400"
              >
                {importing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Categorising with AI...</>) : (<><FileText className="mr-2 h-4 w-4" />Import & Categorise</>)}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* REVIEW */}
      {activeView === "review" && (
        <div className="space-y-4">
          {importStats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Total", value: importStats.total },
                { label: "Categorised", value: importStats.categorised },
                { label: "From Mappings", value: importStats.fromMappings },
                { label: duplicateIndices.length > 0 ? "Duplicates" : "AI Categorised", value: duplicateIndices.length > 0 ? duplicateIndices.length : importStats.fromAI },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs text-zinc-600">{s.label}</p>
                  <p className="text-xl font-bold text-zinc-200">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {duplicateIndices.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {duplicateIndices.length} duplicate(s) detected and will be skipped.
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-medium text-zinc-300">Review Categorisation</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={approveAll} className="text-zinc-500 hover:text-zinc-300">
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve All
                </Button>
                <Button size="sm" onClick={saveTransactions} disabled={saving} className="bg-sky-500 text-white hover:bg-sky-400">
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Save All
                </Button>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto border-t border-white/[0.04]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06]">
                    <TableHead className="w-24 text-zinc-500">Date</TableHead>
                    <TableHead className="text-zinc-500">Description</TableHead>
                    <TableHead className="text-zinc-500">Clean Name</TableHead>
                    <TableHead className="text-zinc-500">Category</TableHead>
                    <TableHead className="text-right text-zinc-500">Amount</TableHead>
                    <TableHead className="w-24 text-zinc-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewTransactions.map((tx, i) => {
                    const isDuplicate = duplicateIndices.includes(i);
                    return (
                      <TableRow key={i} className={`border-white/[0.04] ${isDuplicate ? "opacity-30 line-through" : tx.isReviewed ? "bg-emerald-500/[0.03]" : ""}`}>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-400">{fmtDate(tx.date)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-zinc-600">{tx.rawDescription}</TableCell>
                        <TableCell className="text-sm font-medium text-zinc-300">{tx.cleanDescription}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" style={{ backgroundColor: `${CATEGORY_COLOURS[tx.category] || CATEGORY_COLOURS["Other"]}20`, color: CATEGORY_COLOURS[tx.category] || CATEGORY_COLOURS["Other"] }}>
                            {tx.category}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right whitespace-nowrap text-sm ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCents(tx.amount)}</TableCell>
                        <TableCell>
                          {!isDuplicate && (
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-emerald-400" onClick={() => { const u = [...reviewTransactions]; u[i] = { ...u[i], isReviewed: true }; setReviewTransactions(u); }}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={() => startEdit(i)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <Dialog open={editingIndex !== null} onOpenChange={(open) => { if (!open) setEditingIndex(null); }}>
            <DialogContent className="border-white/[0.08] bg-zinc-900">
              <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
              {editingIndex !== null && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs text-zinc-600">Original</p>
                    <p className="text-sm text-zinc-400">{reviewTransactions[editingIndex]?.rawDescription}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Clean Name</Label>
                    <Input value={editCleanName} onChange={(e) => setEditCleanName(e.target.value)} className="border-white/[0.08] bg-white/[0.03]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">Category</Label>
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger className="border-white/[0.08] bg-white/[0.03]"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setEditingIndex(null)} className="text-zinc-500">Cancel</Button>
                    <Button onClick={saveEdit} className="bg-sky-500 text-white hover:bg-sky-400">Save</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* TRANSACTIONS LIST */}
      {activeView === "list" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 backdrop-blur-sm">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border-white/[0.08] bg-white/[0.03] pl-9 placeholder:text-zinc-700" />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-36 border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="All months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {availableMonths.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-36 border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
              </SelectContent>
            </Select>
            {accounts.length > 0 && (
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-36 border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="All accounts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((acc) => (<SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 backdrop-blur-sm">
            {loadingTxns ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>
            ) : transactions.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">No transactions found.</p>
                <p className="text-xs text-zinc-600">Import a bank statement to get started.</p>
              </div>
            ) : (
              <>
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06]">
                        <TableHead className="text-zinc-500">Date</TableHead>
                        <TableHead className="text-zinc-500">Description</TableHead>
                        <TableHead className="text-zinc-500">Category</TableHead>
                        <TableHead className="text-right text-zinc-500">Amount</TableHead>
                        <TableHead className="text-right text-zinc-500">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id} className="border-white/[0.04]">
                          <TableCell className="whitespace-nowrap text-sm text-zinc-400">{fmtDate(tx.date)}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-zinc-300">{tx.cleanDescription || tx.rawDescription}</p>
                            {tx.cleanDescription && tx.cleanDescription !== tx.rawDescription && (
                              <p className="max-w-xs truncate text-xs text-zinc-600">{tx.rawDescription}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" style={{ backgroundColor: `${CATEGORY_COLOURS[tx.category || "Other"] || CATEGORY_COLOURS["Other"]}20`, color: CATEGORY_COLOURS[tx.category || "Other"] || CATEGORY_COLOURS["Other"] }}>
                              {tx.category || "Other"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap text-sm font-medium ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCents(tx.amount)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-sm text-zinc-600">{tx.balanceAfter != null ? formatCents(tx.balanceAfter) : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3 text-xs text-zinc-500">
                  <span>{transactions.length} transactions</span>
                  <span>Total: <span className={transactions.reduce((s, t) => s + t.amount, 0) >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCents(transactions.reduce((s, t) => s + t.amount, 0))}</span></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SPENDING CHART */}
      {activeView === "chart" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 backdrop-blur-sm">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-40 border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="All months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {availableMonths.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
            <p className="mb-4 text-sm font-medium text-zinc-300">Spending by Category</p>
            {chartData.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">No spending data available.</p>
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} stroke="rgb(113 113 122)" fontSize={12} />
                    <YAxis type="category" dataKey="category" stroke="rgb(113 113 122)" fontSize={12} width={90} />
                    <Tooltip formatter={(value) => [formatCents(value as number), "Spent"]} contentStyle={{ backgroundColor: "rgb(24 24 27)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", color: "rgb(228 228 231)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry) => (<Cell key={entry.category} fill={CATEGORY_COLOURS[entry.category] || CATEGORY_COLOURS["Other"]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {chartData.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {chartData.map((item) => (
                <div key={item.category} className="rounded-xl border border-white/[0.06] bg-zinc-900/60 px-4 py-3 backdrop-blur-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLOURS[item.category] || CATEGORY_COLOURS["Other"] }} />
                    <p className="text-xs text-zinc-500">{item.category}</p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-zinc-200">{formatCents(item.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
