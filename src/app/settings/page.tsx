"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Key,
  Cpu,
  Loader2,
} from "lucide-react";

// ---- AI Settings ----

function AiSettingsSection() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.gemini_api_key) setApiKey(data.gemini_api_key);
        if (data.gemini_model) setModel(data.gemini_model);
        setLoading(false);
      });
  }, []);

  async function save(key: string, value: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) toast.success("Setting saved");
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
      {/* API Key */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-violet-500/10 p-1.5">
            <Key className="h-3.5 w-3.5 text-violet-400" />
          </div>
          Gemini API Key
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Your Google AI Studio API key for Gemini access
        </p>
        <div className="mt-4 flex gap-3">
          <Input
            type="password"
            placeholder="Enter your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-violet-500/30"
          />
          <Button
            size="sm"
            onClick={() => save("gemini_api_key", apiKey)}
            disabled={!apiKey}
            className="bg-violet-500 font-medium text-white hover:bg-violet-400"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-sky-500/10 p-1.5">
            <Cpu className="h-3.5 w-3.5 text-sky-400" />
          </div>
          Model Selection
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Choose the Gemini model for AI features
        </p>
        <div className="mt-4">
          <Select
            value={model}
            onValueChange={(v) => {
              setModel(v);
              save("gemini_model", v);
            }}
          >
            <SelectTrigger className="border-white/[0.08] bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.5-pro">
                Gemini 2.5 Pro (Best)
              </SelectItem>
              <SelectItem value="gemini-2.5-flash">
                Gemini 2.5 Flash (Balanced)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ---- Data Management ----

function DataManagementSection() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    try {
      const res = await fetch("/api/settings/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Data imported successfully");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to import data");
      }
    } catch {
      toast.error("Invalid backup file");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function handleClear() {
    try {
      const res = await fetch("/api/settings/clear", { method: "POST" });
      if (res.ok) {
        toast.success("All data cleared");
        setConfirmClear(false);
      }
    } catch {
      toast.error("Failed to clear data");
    }
  }

  return (
    <div className="space-y-5">
      {/* Export */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-emerald-500/10 p-1.5">
            <Download className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          Export Data
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Download a JSON backup of all your data
        </p>
        <div className="mt-4">
          <Button
            onClick={handleExport}
            variant="ghost"
            className="border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <Download className="mr-2 h-4 w-4" /> Export Backup
          </Button>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-sky-500/10 p-1.5">
            <Upload className="h-3.5 w-3.5 text-sky-400" />
          </div>
          Import Data
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Restore data from a JSON backup file. This will replace all existing
          data.
        </p>
        <div className="mt-4">
          <label>
            <Button
              variant="ghost"
              asChild
              disabled={importing}
              className="border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <span>
                <Upload className="mr-2 h-4 w-4" />{" "}
                {importing ? "Importing..." : "Import Backup"}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Clear All */}
      <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-5">
        <div className="flex items-center gap-2.5 text-sm font-medium text-red-400">
          <div className="rounded-lg bg-red-500/10 p-1.5">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </div>
          Clear All Data
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          Permanently delete all data. This cannot be undone.
        </p>
        <div className="mt-4">
          {!confirmClear ? (
            <Button
              onClick={() => setConfirmClear(true)}
              className="bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear All Data
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Are you absolutely sure? This will delete everything.
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleClear}
                  className="bg-red-500 text-white hover:bg-red-400"
                >
                  Yes, Delete Everything
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmClear(false)}
                  className="text-zinc-500"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Settings Tabs ----

type SettingsTab = "ai" | "data";

const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  accent: string;
}[] = [
  { id: "ai", label: "AI", icon: Brain, accent: "text-violet-400" },
  { id: "data", label: "Data", icon: Database, accent: "text-emerald-400" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          AI configuration and data management
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-1 backdrop-blur-sm max-w-sm">
        {TABS.map((tab) => {
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

      {/* Content */}
      <div>
        {activeTab === "ai" && <AiSettingsSection />}
        {activeTab === "data" && <DataManagementSection />}
      </div>
    </div>
  );
}
