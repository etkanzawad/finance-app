"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type BnplProvider = "afterpay" | "zip_pay" | "zip_money" | "paypal_pay4";

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; fileName: string; agreementId: number }
  | { status: "error"; message: string };

const PROVIDERS: { value: BnplProvider; label: string }[] = [
  { value: "afterpay", label: "Afterpay" },
  { value: "zip_pay", label: "Zip Pay" },
  { value: "zip_money", label: "Zip Money" },
  { value: "paypal_pay4", label: "PayPal Pay in 4" },
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function BnplAgreementUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<BnplProvider>("afterpay");
  const [notes, setNotes] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_BYTES) {
      return "File exceeds 10 MB limit.";
    }
    // Client-side check for UX only - server validates by magic bytes
    const ext = file.name.toLowerCase().split('.').pop();
    const allowedExts = ['pdf', 'md', 'txt'];
    if (!ext || !allowedExts.includes(ext)) {
      return "Only PDF and Markdown (.md, .txt) files are allowed.";
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    setState({ status: "idle" });
  }, [validateFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setState({ status: "idle" });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setState({ status: "uploading" });

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("provider", provider);
    if (notes.trim()) {
      formData.append("notes", notes.trim());
    }

    try {
      const res = await fetch("/api/bnpl-agreements/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setState({ 
        status: "success", 
        fileName: data.fileName,
        agreementId: data.id 
      });
      toast.success("Agreement uploaded successfully!");
      
      // Reset form
      setSelectedFile(null);
      setNotes("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setState({ status: "error", message });
      toast.error(message);
    }
  }, [selectedFile, provider, notes]);

  const reset = useCallback(() => {
    setState({ status: "idle" });
    setSelectedFile(null);
    setNotes("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          BNPL Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as BnplProvider)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Agreement Document
        </label>
        
        {!selectedFile ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
              isDragOver 
                ? "border-violet-500 bg-violet-500/5" 
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
            }`}
          >
            <div className="rounded-full bg-violet-500/10 p-3">
              <Upload className="h-5 w-5 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-300">
                <span className="font-medium text-violet-400">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                PDF or Markdown · max 10 MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.md,.txt"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{selectedFile.name}</p>
                <p className="text-xs text-zinc-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={clearSelection}
              disabled={state.status === "uploading"}
              className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this agreement..."
          rows={3}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
        />
      </div>

      {/* Upload Button */}
      <Button
        onClick={handleUpload}
        disabled={!selectedFile || state.status === "uploading"}
        className="w-full bg-violet-500 font-medium text-white hover:bg-violet-400 disabled:opacity-50"
      >
        {state.status === "uploading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Agreement
          </>
        )}
      </Button>

      {/* Success State */}
      {state.status === "success" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-400">
                Upload successful!
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {state.fileName} has been saved.
              </p>
              <button
                onClick={reset}
                className="mt-3 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Upload another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.status === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">Upload failed</p>
              <p className="text-xs text-zinc-500 mt-1">{state.message}</p>
              <button
                onClick={reset}
                className="mt-3 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
