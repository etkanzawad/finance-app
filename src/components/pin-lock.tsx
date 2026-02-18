"use client";

import { useState, useEffect, useRef } from "react";
import { DollarSign, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PinLock({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "locked" | "unlocked">("loading");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        if (!data.hasPin) {
          setState("unlocked");
        } else {
          setState("locked");
        }
      })
      .catch(() => setState("unlocked"));
  }, []);

  async function handleSubmit() {
    setError("");
    const res = await fetch("/api/profile/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.valid) {
      setState("unlocked");
    } else {
      setError("Incorrect PIN");
      setPin("");
      inputRef.current?.focus();
    }
  }

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (state === "unlocked") {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-xs space-y-6 text-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">
            {name ? `Welcome back, ${name}` : "Mint Finance"}
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Enter your PIN to unlock
          </div>
        </div>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="****"
            className="w-full text-center text-2xl tracking-[0.5em] bg-card border border-border rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary"
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(val);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin.length === 4) handleSubmit();
            }}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={pin.length !== 4}
          >
            Unlock
          </Button>
        </div>
      </div>
    </div>
  );
}
