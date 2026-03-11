"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Compact inline fallback for use inside chat bubbles / cards */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to render this component.</span>
          <button
            onClick={this.handleReset}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-zinc-200">Something went wrong</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }
}
