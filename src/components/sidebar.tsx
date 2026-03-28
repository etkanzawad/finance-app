"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  DollarSign,
  Heart,
  User,
  LogOut,
  MessageSquare,
  Receipt,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const mainNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/bnpl", label: "BNPL Tracker", icon: CreditCard },
  { href: "/history", label: "Chat History", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

const profileItem = { href: "/profile", label: "Profile", icon: User };

export function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: (typeof mainNavItems)[0];
  pathname: string;
  onClick?: () => void;
}) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-[#c4f441]/10 text-[#c4f441]"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      )}
    >
      <item.icon
        className={cn(
          "h-[18px] w-[18px] transition-colors duration-150",
          isActive
            ? "text-[#c4f441]"
            : "text-zinc-500 group-hover:text-zinc-300"
        )}
      />
      {item.label}
      {isActive && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c4f441]" />
      )}
    </Link>
  );
}

/* ─── Desktop Sidebar ─────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex w-64 flex-col m-3 mr-0 rounded-2xl border border-white/[0.06] bg-zinc-950">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
        <div className="rounded-xl bg-[#c4f441]/15 p-2">
          <DollarSign className="h-5 w-5 text-[#c4f441]" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">
          Mint Finance
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Profile & Sign Out at bottom */}
      <div className="border-t border-white/[0.06] px-3 py-3 space-y-1">
        <NavLink item={profileItem} pathname={pathname} />
        <button
          onClick={handleSignOut}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px] text-zinc-500 transition-colors duration-150 group-hover:text-red-400" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ─── Mobile Side Drawer ──────────────────────────────────── */
export function MobileSideDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Auto-close on navigation
  useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function handleSignOut() {
    onClose();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.06] bg-zinc-950 transition-transform duration-300 ease-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#c4f441]/15 p-2">
              <DollarSign className="h-5 w-5 text-[#c4f441]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Mint Finance
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onClick={onClose}
            />
          ))}
        </nav>

        {/* Profile & Sign Out */}
        <div className="border-t border-white/[0.06] px-3 py-3 space-y-1">
          <NavLink item={profileItem} pathname={pathname} onClick={onClose} />
          <button
            onClick={handleSignOut}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px] text-zinc-500 transition-colors duration-150 group-hover:text-red-400" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
