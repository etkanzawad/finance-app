"use client";

import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-200">Something went wrong</h2>
        <p className="mt-2 max-w-md text-sm text-zinc-500">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
