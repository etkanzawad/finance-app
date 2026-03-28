"use client";

import { Menu } from "lucide-react";

export function MobileHamburger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Open navigation"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
        left: "calc(env(safe-area-inset-left, 0px) + 1rem)",
      }}
      className="fixed z-30 flex items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/90 p-2.5 text-zinc-300 shadow-lg backdrop-blur-md transition-all duration-150 hover:border-white/[0.14] hover:bg-zinc-800/90 hover:text-white lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
