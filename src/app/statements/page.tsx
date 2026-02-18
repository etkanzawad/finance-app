"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileText,
  Check,
  Pencil,
  Search,
  AlertTriangle,
  Loader2,
  BarChart3,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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

const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Entertainment",
  "Shopping",
  "Health",
  "Utilities",
  "Rent/Housing",
  "Subscriptions",
  "Insurance",
  "Transfers",
  "Income",
  "Cash Withdrawal",
  "Fees",
  "Other",
];

const CATEGORY_COLOURS: Record<string, string> = {
  Groceries: "hsl(142, 71%, 45%)",
  Dining: "hsl(25, 95%, 53%)",
  Transport: "hsl(217, 91%, 60%)",
  Entertainment: "hsl(271, 91%, 65%)",
  Shopping: "hsl(340, 82%, 52%)",
  Health: "hsl(174, 72%, 46%)",
  Utilities: "hsl(48, 96%, 53%)",
  "Rent/Housing": "hsl(199, 89%, 48%)",
  Subscriptions: "hsl(292, 84%, 61%)",
  Insurance: "hsl(162, 73%, 46%)",
  Transfers: "hsl(215, 20%, 65%)",
  Income: "hsl(142, 76%, 36%)",
  "Cash Withdrawal": "hsl(0, 0%, 60%)",
  Fees: "hsl(0, 84%, 60%)",
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

interface Account {
  id: number;
  name: string;
  type: string;
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Parse NAB CSV rows - handles both single-amount and debit/credit columns
function parseNabCsv(csvData: string[][]): ParsedTx[] {
  const transactions: ParsedTx[] = [];

  for (const row of csvData) {
    if (row.length < 3) continue;

    // Try to detect format by checking columns
    // Format 1: Date, Amount, Description, Balance (single amount)
    // Format 2: Date, Description, Debit, Credit, Balance (separate debit/credit)
    // Format 3: Date, Amount, Description, Balance, Type

    let date = "";
    let description = "";
    let amount = 0;
    let balance: number | undefined;

    // Check if the row looks like it has a date in first column
    const dateStr = row[0]?.trim();
    if (!dateStr || !/\d/.test(dateStr)) continue;

    // Parse date - NAB uses DD/MM/YYYY or DD/MM/YY
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    date = `${year}-${month}-${day}`;

    // Detect format based on column count and content
    if (row.length >= 5) {
      // Could be debit/credit format: Date, Description, Debit, Credit, Balance
      const col2 = row[2]?.trim();
      const col3 = row[3]?.trim();
      const isDebitCreditFormat =
        (col2 === "" || /^-?[\d,]+\.?\d*$/.test(col2.replace(/[,$]/g, ""))) &&
        (col3 === "" || /^-?[\d,]+\.?\d*$/.test(col3.replace(/[,$]/g, "")));

      if (isDebitCreditFormat && isNaN(Number(row[1]?.replace(/[,$]/g, "")))) {
        // Debit/Credit format
        description = row[1]?.trim() || "";
        const debit = parseFloat(col2.replace(/[,$]/g, "")) || 0;
        const credit = parseFloat(col3.replace(/[,$]/g, "")) || 0;
        amount = credit > 0 ? Math.round(credit * 100) : -Math.round(debit * 100);
        const balStr = row[4]?.trim().replace(/[,$]/g, "");
        if (balStr) balance = Math.round(parseFloat(balStr) * 100);
      } else {
        // Single amount: Date, Amount, Description, Balance, ...
        const amtStr = row[1]?.trim().replace(/[,$]/g, "");
        amount = Math.round(parseFloat(amtStr) * 100);
        description = row[2]?.trim() || "";
        const balStr = row[3]?.trim().replace(/[,$]/g, "");
        if (balStr && !isNaN(parseFloat(balStr))) {
          balance = Math.round(parseFloat(balStr) * 100);
        }
      }
    } else if (row.length >= 3) {
      // Minimal format: Date, Amount, Description
      const amtStr = row[1]?.trim().replace(/[,$]/g, "");
      amount = Math.round(parseFloat(amtStr) * 100);
      description = row[2]?.trim() || "";
      if (row[3]) {
        const balStr = row[3]?.trim().replace(/[,$]/g, "");
        if (balStr && !isNaN(parseFloat(balStr))) {
          balance = Math.round(parseFloat(balStr) * 100);
        }
      }
    }

    if (!description || isNaN(amount)) continue;

    const statementMonth = `${year}-${month}`;

    transactions.push({
      date,
      rawDescription: description,
      amount,
      balanceAfter: balance,
      statementMonth,
    });
  }

  return transactions;
}

export default function StatementsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [activeTab, setActiveTab] = useState("upload");

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTx[]>([]);
  const [importing, setImporting] = useState(false);

  // Review state
  const [reviewTransactions, setReviewTransactions] = useState<ReviewTx[]>([]);
  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([]);
  const [importStats, setImportStats] = useState<{
    total: number;
    categorised: number;
    fromMappings: number;
    fromAI: number;
  } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editCleanName, setEditCleanName] = useState("");
  const [saving, setSaving] = useState(false);

  // Transaction list state
  const [transactions, setTransactions] = useState<SavedTx[]>([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingTxns, setLoadingTxns] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load accounts on mount
  useEffect(() => {
    fetch("/api/settings?section=accounts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAccounts(data);
      })
      .catch(() => {});

    // Also try direct accounts endpoint
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setAccounts(data);
      })
      .catch(() => {});
  }, []);

  // Load transactions when filters change
  useEffect(() => {
    if (activeTab !== "list" && activeTab !== "chart") return;
    loadTransactions();
  }, [activeTab, filterMonth, filterCategory, filterAccount, searchQuery]);

  async function loadTransactions() {
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
    } catch {
      toast.error("Failed to load transactions");
    }
    setLoadingTxns(false);
  }

  // CSV file handling
  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }

      Papa.parse(file, {
        complete: (results) => {
          const data = results.data as string[][];
          // Filter out header rows and empty rows
          const filtered = data.filter((row) => {
            if (row.length < 3) return false;
            const first = row[0]?.trim();
            return first && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(first);
          });

          const parsed = parseNabCsv(filtered);
          if (parsed.length === 0) {
            toast.error("No transactions found in CSV");
            return;
          }

          setParsedTransactions(parsed);
          toast.success(`Parsed ${parsed.length} transactions`);
        },
        error: () => {
          toast.error("Failed to parse CSV file");
        },
      });
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Import and categorise
  async function handleImport() {
    if (!selectedAccount) {
      toast.error("Please select an account first");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: parsedTransactions,
          accountId: Number(selectedAccount),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      const data = await res.json();
      setReviewTransactions(data.transactions);
      setDuplicateIndices(data.duplicates || []);
      setImportStats({
        total: data.total,
        categorised: data.categorised,
        fromMappings: data.fromMappings,
        fromAI: data.fromAI,
      });
      setActiveTab("review");
      toast.success(
        `Categorised ${data.total} transactions (${data.fromMappings} from saved mappings)`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Import failed"
      );
    }
    setImporting(false);
  }

  // Edit a transaction's category/name
  function startEdit(index: number) {
    setEditingIndex(index);
    setEditCategory(reviewTransactions[index].category);
    setEditCleanName(reviewTransactions[index].cleanDescription);
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const updated = [...reviewTransactions];
    updated[editingIndex] = {
      ...updated[editingIndex],
      category: editCategory,
      cleanDescription: editCleanName,
      isReviewed: true,
    };
    setReviewTransactions(updated);
    setEditingIndex(null);
  }

  function approveTransaction(index: number) {
    const updated = [...reviewTransactions];
    updated[index] = { ...updated[index], isReviewed: true };
    setReviewTransactions(updated);
  }

  function approveAll() {
    setReviewTransactions((prev) =>
      prev.map((tx) => ({ ...tx, isReviewed: true }))
    );
  }

  // Save reviewed transactions
  async function saveTransactions() {
    setSaving(true);
    // Filter out duplicates
    const toSave = reviewTransactions.filter(
      (_, i) => !duplicateIndices.includes(i)
    );

    try {
      // Save transactions
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: toSave }),
      });

      if (!res.ok) throw new Error("Save failed");

      // Save merchant mappings for reviewed/edited transactions
      const editedMappings = toSave
        .filter((tx) => tx.isReviewed)
        .map((tx) => ({
          rawPattern: tx.rawDescription
            .toLowerCase()
            .replace(/\d/g, "")
            .trim()
            .slice(0, 30),
          cleanName: tx.cleanDescription,
          category: tx.category,
        }))
        .filter(
          (m, i, arr) =>
            m.rawPattern.length > 3 &&
            arr.findIndex((x) => x.rawPattern === m.rawPattern) === i
        );

      if (editedMappings.length > 0) {
        await fetch("/api/categorise", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappings: editedMappings }),
        });
      }

      const data = await res.json();
      toast.success(
        `Saved ${data.inserted} transactions${
          duplicateIndices.length > 0
            ? ` (${duplicateIndices.length} duplicates skipped)`
            : ""
        }`
      );
      setReviewTransactions([]);
      setParsedTransactions([]);
      setImportStats(null);
      setActiveTab("list");
      loadTransactions();
    } catch {
      toast.error("Failed to save transactions");
    }
    setSaving(false);
  }

  // Chart data
  const chartData = CATEGORIES.filter((cat) => cat !== "Income" && cat !== "Transfers")
    .map((category) => {
      const total = transactions
        .filter((tx) => tx.category === category && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      return { category, total };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  // Available months from transactions
  const availableMonths = Array.from(
    new Set(transactions.map((tx) => tx.statementMonth).filter(Boolean))
  ).sort().reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statements</h1>
        <p className="text-muted-foreground">
          Import bank statements, review categorisation, and track spending
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="gap-2"
            disabled={reviewTransactions.length === 0}
          >
            <Check className="h-4 w-4" />
            Review
            {reviewTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {reviewTransactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Spending
          </TabsTrigger>
        </TabsList>

        {/* UPLOAD TAB */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Account</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <Select
                  value={selectedAccount}
                  onValueChange={setSelectedAccount}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Choose account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No accounts found. Add accounts in Settings first.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-1">
                  Drop your bank statement CSV here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse. Supports NAB CSV exports.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </CardContent>
          </Card>

          {parsedTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Parsed {parsedTransactions.length} Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-64 overflow-y-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTransactions.slice(0, 20).map((tx, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {tx.rawDescription}
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap ${
                              tx.amount >= 0
                                ? "text-green-500"
                                : "text-red-400"
                            }`}
                          >
                            {formatCents(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedTransactions.length > 20 && (
                    <p className="p-2 text-center text-sm text-muted-foreground">
                      ... and {parsedTransactions.length - 20} more
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleImport}
                  disabled={importing || !selectedAccount}
                  className="w-full"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Categorising with AI...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Import & Categorise
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* REVIEW TAB */}
        <TabsContent value="review" className="space-y-4">
          {importStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{importStats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Categorised</p>
                  <p className="text-2xl font-bold">{importStats.categorised}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">From Mappings</p>
                  <p className="text-2xl font-bold">{importStats.fromMappings}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    {duplicateIndices.length > 0
                      ? "Duplicates Found"
                      : "AI Categorised"}
                  </p>
                  <p className="text-2xl font-bold">
                    {duplicateIndices.length > 0
                      ? duplicateIndices.length
                      : importStats.fromAI}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {duplicateIndices.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardContent className="pt-4 flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">
                  {duplicateIndices.length} duplicate transaction(s) detected and
                  will be skipped on save.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Review Categorisation</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={approveAll}>
                  <Check className="h-4 w-4 mr-1" />
                  Approve All
                </Button>
                <Button size="sm" onClick={saveTransactions} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Save All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Clean Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewTransactions.map((tx, i) => {
                      const isDuplicate = duplicateIndices.includes(i);
                      return (
                        <TableRow
                          key={i}
                          className={
                            isDuplicate
                              ? "opacity-40 line-through"
                              : tx.isReviewed
                              ? "bg-green-500/5"
                              : ""
                          }
                        >
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {tx.rawDescription}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {tx.cleanDescription}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: `${
                                  CATEGORY_COLOURS[tx.category] || CATEGORY_COLOURS["Other"]
                                }20`,
                                color:
                                  CATEGORY_COLOURS[tx.category] ||
                                  CATEGORY_COLOURS["Other"],
                              }}
                            >
                              {tx.category}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap ${
                              tx.amount >= 0
                                ? "text-green-500"
                                : "text-red-400"
                            }`}
                          >
                            {formatCents(tx.amount)}
                          </TableCell>
                          <TableCell>
                            {!isDuplicate && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => approveTransaction(i)}
                                >
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => startEdit(i)}
                                >
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
            </CardContent>
          </Card>

          {/* Edit dialog */}
          <Dialog
            open={editingIndex !== null}
            onOpenChange={(open) => {
              if (!open) setEditingIndex(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
              </DialogHeader>
              {editingIndex !== null && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Original
                    </p>
                    <p className="text-sm">
                      {reviewTransactions[editingIndex]?.rawDescription}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Clean Name</label>
                    <Input
                      value={editCleanName}
                      onChange={(e) => setEditCleanName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={editCategory}
                      onValueChange={setEditCategory}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingIndex(null)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={saveEdit}>Save</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TRANSACTIONS LIST TAB */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accounts.length > 0 && (
                  <Select
                    value={filterAccount}
                    onValueChange={setFilterAccount}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {loadingTxns ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No transactions found.</p>
                  <p className="text-sm">
                    Import a bank statement to get started.
                  </p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {tx.cleanDescription || tx.rawDescription}
                              </p>
                              {tx.cleanDescription &&
                                tx.cleanDescription !== tx.rawDescription && (
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                                    {tx.rawDescription}
                                  </p>
                                )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: `${
                                  CATEGORY_COLOURS[tx.category || "Other"] ||
                                  CATEGORY_COLOURS["Other"]
                                }20`,
                                color:
                                  CATEGORY_COLOURS[tx.category || "Other"] ||
                                  CATEGORY_COLOURS["Other"],
                              }}
                            >
                              {tx.category || "Other"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap font-medium ${
                              tx.amount >= 0
                                ? "text-green-500"
                                : "text-red-400"
                            }`}
                          >
                            {formatCents(tx.amount)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
                            {tx.balanceAfter != null
                              ? formatCents(tx.balanceAfter)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {transactions.length > 0 && (
                <div className="flex justify-between items-center mt-3 text-sm text-muted-foreground">
                  <span>{transactions.length} transactions</span>
                  <span>
                    Total:{" "}
                    <span
                      className={
                        transactions.reduce((s, t) => s + t.amount, 0) >= 0
                          ? "text-green-500"
                          : "text-red-400"
                      }
                    >
                      {formatCents(
                        transactions.reduce((s, t) => s + t.amount, 0)
                      )}
                    </span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SPENDING CHART TAB */}
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No spending data available.</p>
                  <p className="text-sm">
                    Import transactions to see your spending breakdown.
                  </p>
                </div>
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, bottom: 0, left: 100 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={90}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCents(value as number),
                          "Spent",
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.category}
                            fill={
                              CATEGORY_COLOURS[entry.category] ||
                              CATEGORY_COLOURS["Other"]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spending summary cards */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {chartData.map((item) => (
                <Card key={item.category}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            CATEGORY_COLOURS[item.category] ||
                            CATEGORY_COLOURS["Other"],
                        }}
                      />
                      <p className="text-sm text-muted-foreground">
                        {item.category}
                      </p>
                    </div>
                    <p className="text-lg font-bold">
                      {formatCents(item.total)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
