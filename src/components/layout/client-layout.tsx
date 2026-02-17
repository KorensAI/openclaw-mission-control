"use client";

import { useStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, theme } = useStore();

  return (
    <div className={theme}>
      <Sidebar />
      <Header />
      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          sidebarOpen ? "pl-64" : "pl-16"
        )}
      >
        <div className="p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
