"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  BarChart2,
  Bell,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

// ─── Budget Thresholds ──────────────────────────────────────────────────────

interface BudgetThresholds {
  daily: number;
  weekly: number;
  monthly: number;
}

const STORAGE_KEY = "openclaw-budget-thresholds";

const DEFAULT_THRESHOLDS: BudgetThresholds = {
  daily: 5,
  weekly: 25,
  monthly: 100,
};

function loadThresholds(): BudgetThresholds {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<BudgetThresholds>;
    return {
      daily: parsed.daily ?? DEFAULT_THRESHOLDS.daily,
      weekly: parsed.weekly ?? DEFAULT_THRESHOLDS.weekly,
      monthly: parsed.monthly ?? DEFAULT_THRESHOLDS.monthly,
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

function saveThresholds(thresholds: BudgetThresholds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
}

// ─── Alert status helpers ───────────────────────────────────────────────────

type AlertLevel = "ok" | "warning" | "exceeded";

function getAlertLevel(spent: number, budget: number): AlertLevel {
  if (budget <= 0) return "ok";
  const ratio = spent / budget;
  if (ratio >= 1) return "exceeded";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

function getAlertColor(level: AlertLevel) {
  switch (level) {
    case "exceeded":
      return {
        text: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        progress: "bg-red-500",
        badge: "bg-red-500/20 text-red-300 border-red-500/30",
      };
    case "warning":
      return {
        text: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        progress: "bg-yellow-500",
        badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      };
    default:
      return {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        progress: "bg-emerald-500",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      };
  }
}

function AlertIcon({ level }: { level: AlertLevel }) {
  switch (level) {
    case "exceeded":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    default:
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
  }
}

// ─── Model colors ───────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-5-20250929": "#10b981",
  "claude-haiku-4-5-20251001": "#6366f1",
};

function shortModel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

// ─── Budget Alert Card Component ────────────────────────────────────────────

function BudgetAlertRow({
  label,
  spent,
  budget,
  icon: Icon,
}: {
  label: string;
  spent: number;
  budget: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const level = getAlertLevel(spent, budget);
  const colors = getAlertColor(level);
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const overBudget = spent > budget && budget > 0;

  return (
    <div className={`rounded-lg p-3.5 border ${colors.border} ${colors.bg} transition-all`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${colors.text}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertIcon level={level} />
          {level === "exceeded" && (
            <Badge
              variant="outline"
              className={`text-[10px] py-0 h-4 border ${colors.badge}`}
            >
              OVER BUDGET
            </Badge>
          )}
          {level === "warning" && (
            <Badge
              variant="outline"
              className={`text-[10px] py-0 h-4 border ${colors.badge}`}
            >
              NEAR LIMIT
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-lg font-bold ${overBudget ? "text-red-400" : ""}`}>
          ${spent.toFixed(2)}
        </span>
        <span className="text-xs text-muted-foreground">
          / ${budget.toFixed(2)} budget
        </span>
      </div>

      {/* Custom progress bar with dynamic color */}
      <div className="h-2 w-full rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.progress}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">
          {pct.toFixed(0)}% used
        </span>
        {budget > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {overBudget
              ? `$${(spent - budget).toFixed(2)} over`
              : `$${(budget - spent).toFixed(2)} remaining`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Threshold Editor Dialog ────────────────────────────────────────────────

function ThresholdEditor({
  thresholds,
  onSave,
}: {
  thresholds: BudgetThresholds;
  onSave: (t: BudgetThresholds) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(thresholds);

  useEffect(() => {
    setDraft(thresholds);
  }, [thresholds]);

  function handleSave() {
    onSave(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-white/10 hover:bg-white/[0.05]"
        >
          <Settings className="h-3 w-3 mr-1" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#0f0f0f] border-white/10">
        <DialogHeader>
          <DialogTitle>Budget Thresholds</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Daily Budget (USD)
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={draft.daily}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  daily: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-white/[0.03] border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Weekly Budget (USD)
            </Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={draft.weekly}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  weekly: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-white/[0.03] border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Monthly Budget (USD)
            </Label>
            <Input
              type="number"
              step="5"
              min="0"
              value={draft.monthly}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  monthly: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-white/[0.03] border-white/10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Thresholds are saved locally in your browser. Yellow indicator
            appears at 80% usage, red when exceeded.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Save Thresholds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CostsPage() {
  const { costEntries, agents, hydrated } = useStore();
  const [thresholds, setThresholds] = useState<BudgetThresholds>(DEFAULT_THRESHOLDS);

  // Load thresholds from localStorage on mount
  useEffect(() => {
    setThresholds(loadThresholds());
  }, []);

  const handleSaveThresholds = useCallback((t: BudgetThresholds) => {
    setThresholds(t);
    saveThresholds(t);
  }, []);

  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading cost data...
        </p>
      </div>
    );
  }

  if (costEntries.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <DollarSign className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No cost data yet</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Cost entries will appear here once agents start processing sessions.
          Data is read from{" "}
          <code className="bg-muted px-1 rounded">~/.openclaw/costs.jsonl</code>{" "}
          or derived from session logs.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const todayCost = costEntries
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.cost, 0);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekCost = costEntries
    .filter((e) => e.date >= weekAgo)
    .reduce((s, e) => s + e.cost, 0);

  const monthAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0];
  const monthCost = costEntries
    .filter((e) => e.date >= monthAgo)
    .reduce((s, e) => s + e.cost, 0);
  const projectedMonthly = (monthCost / 30) * 30;

  // Count how many alert levels are triggered
  const alertLevels = [
    getAlertLevel(todayCost, thresholds.daily),
    getAlertLevel(weekCost, thresholds.weekly),
    getAlertLevel(monthCost, thresholds.monthly),
  ];
  const exceededCount = alertLevels.filter((l) => l === "exceeded").length;
  const warningCount = alertLevels.filter((l) => l === "warning").length;

  // Daily line chart data -- last 30 days
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000);
    const key = d.toISOString().split("T")[0];
    const cost = costEntries
      .filter((e) => e.date === key)
      .reduce((s, e) => s + e.cost, 0);
    return {
      date: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      cost: parseFloat(cost.toFixed(2)),
    };
  });

  // Pie: cost by model
  const modelMap: Record<string, number> = {};
  costEntries.forEach((e) => {
    modelMap[e.model] = (modelMap[e.model] ?? 0) + e.cost;
  });
  const pieData = Object.entries(modelMap).map(([model, cost]) => ({
    name: shortModel(model),
    value: parseFloat(cost.toFixed(2)),
    model,
  }));

  // Bar: cost by agent
  const agentMap: Record<string, number> = {};
  costEntries.forEach((e) => {
    agentMap[e.agentId] = (agentMap[e.agentId] ?? 0) + e.cost;
  });
  const barData = Object.entries(agentMap).map(([agentId, cost]) => {
    const agent = agents.find((a) => a.id === agentId);
    return {
      name: agent ? agent.emoji + " " + agent.name : agentId,
      cost: parseFloat(cost.toFixed(2)),
    };
  });

  const recentEntries = costEntries.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ─── Budget Alerts Card ─────────────────────────────────────────── */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-base">Budget Alerts</CardTitle>
            {exceededCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 border bg-red-500/20 text-red-300 border-red-500/30"
              >
                {exceededCount} exceeded
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 border bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
              >
                {warningCount} near limit
              </Badge>
            )}
            {exceededCount === 0 && warningCount === 0 && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 border bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              >
                All clear
              </Badge>
            )}
          </div>
          <ThresholdEditor
            thresholds={thresholds}
            onSave={handleSaveThresholds}
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BudgetAlertRow
              label="Daily"
              spent={todayCost}
              budget={thresholds.daily}
              icon={DollarSign}
            />
            <BudgetAlertRow
              label="Weekly"
              spent={weekCost}
              budget={thresholds.weekly}
              icon={Calendar}
            />
            <BudgetAlertRow
              label="Monthly"
              spent={monthCost}
              budget={thresholds.monthly}
              icon={TrendingUp}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${weekCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Monthly
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${projectedMonthly.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Line Chart ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Cost -- Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => "$" + v}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                }}
                formatter={(v: unknown) => [
                  "$" + (v as number).toFixed(2),
                  "Cost",
                ]}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ─── Pie + Bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    name + " " + ((percent ?? 0) * 100).toFixed(0) + "%"
                  }
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={MODEL_COLORS[entry.model] ?? "#6366f1"}
                    />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  formatter={(v: unknown) => [
                    "$" + (v as number).toFixed(2),
                    "Cost",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => "$" + v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                  }}
                  formatter={(v: unknown) => [
                    "$" + (v as number).toFixed(2),
                    "Cost",
                  ]}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ─── Recent Entries Table ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cost Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">
                    Date
                  </th>
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">
                    Agent
                  </th>
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">
                    Model
                  </th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">
                    Input Tokens
                  </th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">
                    Output Tokens
                  </th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry, i) => {
                  const agent = agents.find((a) => a.id === entry.agentId);
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="px-6 py-3 text-muted-foreground">
                        {entry.date}
                      </td>
                      <td className="px-6 py-3">
                        {agent
                          ? agent.emoji + " " + agent.name
                          : entry.agentId}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {shortModel(entry.model)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {entry.inputTokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {entry.outputTokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        ${entry.cost.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
