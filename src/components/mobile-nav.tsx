"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  Heart,
  Sparkles,
  Menu,
  X,
  Target,
  FileText,
  ShoppingBag,
  User,
  Settings,
  LogOut,
  DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const tabItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/bnpl", label: "BNPL", icon: CreditCard },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

const moreItems = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/purchase", label: "Purchase Advisor", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const supabase = createClient();

  const isMoreActive = moreItems.some((item) => isActive(pathname, item.href));

  async function handleSignOut() {
    setMoreOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* More drawer backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out lg:hidden",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-3 mb-[calc(env(safe-area-inset-bottom)+4.5rem)] rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-[#c4f441]/15 p-1.5">
                <DollarSign className="h-4 w-4 text-[#c4f441]" />
              </div>
              <span className="text-sm font-semibold text-white">More</span>
            </div>
            <button
              onClick={() => setMoreOpen(false)}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Links */}
          <nav className="p-3 space-y-0.5">
            {moreItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    active
                      ? "bg-[#c4f441]/10 text-[#c4f441]"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px]",
                      active ? "text-[#c4f441]" : "text-zinc-500"
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c4f441]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="border-t border-white/[0.06] p-3">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-[18px] w-[18px] text-zinc-500" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-zinc-950/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex items-center justify-around px-2 py-1.5">
          {tabItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all",
                  active
                    ? "text-[#c4f441]"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-[#c4f441]" : "text-zinc-500"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all",
              isMoreActive || moreOpen
                ? "text-[#c4f441]"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Menu
              className={cn(
                "h-5 w-5",
                isMoreActive || moreOpen ? "text-[#c4f441]" : "text-zinc-500"
              )}
            />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
