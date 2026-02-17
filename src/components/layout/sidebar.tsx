"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  KanbanSquare,
  ScrollText,
  DollarSign,
  Brain,
  MessageSquare,
  Radio,
  Clock,
  Puzzle,
  Settings,
  ChevronLeft,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare, badge: true },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/costs", label: "Cost Analytics", icon: DollarSign },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/channels", label: "Channels", icon: Radio },
  { href: "/cron", label: "Cron Jobs", icon: Clock },
  { href: "/skills", label: "Skills", icon: Puzzle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, gateway, tasks, agents } = useStore();
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border/40 bg-background/95 backdrop-blur transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border/40 px-4">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-lg tracking-tight">
              Mission Control
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              !sidebarOpen && "rotate-180"
            )}
          />
        </Button>
      </div>

      {/* Gateway Status */}
      <div className="px-3 py-3 border-b border-border/40">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2",
            gateway.running
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-red-500/10 text-red-500"
          )}
        >
          <Activity className="h-4 w-4 shrink-0" />
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="text-xs font-medium">
                Gateway {gateway.running ? "Online" : "Offline"}
              </span>
              <span className="text-[10px] opacity-70">
                v{gateway.version} · {gateway.activeSessions} sessions
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && (
                <span className="flex-1">{item.label}</span>
              )}
              {sidebarOpen && item.badge && inboxCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 px-1 text-[10px]"
                >
                  {inboxCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Agent Summary */}
      {sidebarOpen && (
        <div className="border-t border-border/40 p-4">
          <p className="text-xs text-muted-foreground mb-2">Active Agents</p>
          <div className="flex items-center gap-1">
            {agents.length === 0 ? (
              <span className="text-xs text-muted-foreground">No agents</span>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm",
                    agent.status === "online" && "bg-emerald-500/10",
                    agent.status === "busy" && "bg-amber-500/10",
                    agent.status === "offline" && "bg-muted",
                    agent.status === "error" && "bg-red-500/10"
                  )}
                  title={`${agent.name} - ${agent.status}`}
                >
                  {agent.emoji}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
