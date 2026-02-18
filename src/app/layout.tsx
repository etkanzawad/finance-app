import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { PinLock } from "@/components/pin-lock";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mint Finance",
  description: "Personal finance dashboard and purchase advisor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <TooltipProvider>
          <PinLock>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                {children}
              </main>
            </div>
          </PinLock>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
