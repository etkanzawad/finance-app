"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Lock, Unlock, ShieldCheck, Loader2 } from "lucide-react";

export function ProfileSection() {
  const [name, setName] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        setHasPin(data.hasPin);
        setLoading(false);
      });
  }, []);

  async function saveName() {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) toast.success("Name updated");
    else toast.error("Failed to save");
  }

  async function handleSetPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs don't match");
      return;
    }
    const body: Record<string, string> = {
      action: hasPin ? "change_pin" : "set_pin",
      pin: newPin,
    };
    if (hasPin) body.currentPin = currentPin;

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success(hasPin ? "PIN changed" : "PIN set");
      setHasPin(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to update PIN");
    }
  }

  async function handleRemovePin() {
    if (!currentPin) {
      toast.error("Enter your current PIN to remove it");
      return;
    }
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_pin", currentPin }),
    });
    if (res.ok) {
      toast.success("PIN removed");
      setHasPin(false);
      setCurrentPin("");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to remove PIN");
    }
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
      {/* Display Name */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
          <div className="rounded-lg bg-sky-500/10 p-1.5">
            <User className="h-3.5 w-3.5 text-sky-400" />
          </div>
          Display Name
        </div>
        <div className="mt-4 flex gap-3">
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-white/[0.08] bg-white/[0.03] placeholder:text-zinc-700 focus-visible:ring-sky-500/30"
          />
          <Button
            size="sm"
            onClick={saveName}
            disabled={!name.trim()}
            className="bg-sky-500 font-medium text-white hover:bg-sky-400 active:bg-sky-600"
          >
            Save
          </Button>
        </div>
      </div>

      {/* PIN Lock */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-medium text-zinc-400">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              {hasPin ? (
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </div>
            PIN Lock
          </div>
          {hasPin && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              Active
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {hasPin
            ? "Your app is protected with a 4-digit PIN"
            : "Set a 4-digit PIN to lock the app on startup"}
        </p>

        <div className="mt-4 space-y-4">
          {hasPin && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Current PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={currentPin}
                onChange={(e) =>
                  setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
          )}

          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">
                {hasPin ? "New PIN" : "PIN"}
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Confirm</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="****"
                className="w-32 border-white/[0.08] bg-white/[0.03] text-center tracking-[0.5em] placeholder:text-zinc-700 placeholder:tracking-[0.3em] focus-visible:ring-emerald-500/30"
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSetPin}
              disabled={
                newPin.length !== 4 ||
                confirmPin.length !== 4 ||
                (hasPin && currentPin.length !== 4)
              }
              className="bg-emerald-500 font-medium text-white hover:bg-emerald-400"
            >
              {hasPin ? "Change PIN" : "Set PIN"}
            </Button>
            {hasPin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemovePin}
                disabled={currentPin.length !== 4}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              >
                Remove PIN
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
