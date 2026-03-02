"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileSideDrawer } from "@/components/sidebar";
import { MobileHamburger } from "@/components/mobile-nav";

const AUTH_ROUTES = ["/login"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile hamburger trigger */}
      <MobileHamburger onOpen={() => setMobileNavOpen(true)} />

      {/* Mobile slide-in drawer */}
      <MobileSideDrawer
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
    </div>
  );
}
