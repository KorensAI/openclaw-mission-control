"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, BarChart2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-5-20250929":  "#10b981",
  "claude-haiku-4-5-20251001": "#6366f1",
};

function shortModel(model: string): string {
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku"))  return "Haiku";
  return model;
}

export default function CostsPage() {
  const { costEntries, agents } = useStore();

  const today     = new Date().toISOString().split("T")[0];
  const todayCost = costEntries.filter((e) => e.date === today).reduce((s, e) => s + e.cost, 0);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const weekCost = costEntries.filter((e) => e.date >= weekAgo).reduce((s, e) => s + e.cost, 0);

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const monthCost = costEntries.filter((e) => e.date >= monthAgo).reduce((s, e) => s + e.cost, 0);
  const projectedMonthly = (monthCost / 30) * 30;

  // Daily line chart data — last 30 days
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000);
    const key = d.toISOString().split("T")[0];
    const cost = costEntries.filter((e) => e.date === key).reduce((s, e) => s + e.cost, 0);
    return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), cost: parseFloat(cost.toFixed(2)) };
  });

  // Pie: cost by model
  const modelMap: Record<string, number> = {};
  costEntries.forEach((e) => { modelMap[e.model] = (modelMap[e.model] ?? 0) + e.cost; });
  const pieData = Object.entries(modelMap).map(([model, cost]) => ({ name: shortModel(model), value: parseFloat(cost.toFixed(2)), model }));

  // Bar: cost by agent
  const agentMap: Record<string, number> = {};
  costEntries.forEach((e) => { agentMap[e.agentId] = (agentMap[e.agentId] ?? 0) + e.cost; });
  const barData = Object.entries(agentMap).map(([agentId, cost]) => {
    const agent = agents.find((a) => a.id === agentId);
    return { name: agent ? agent.emoji + " " + agent.name : agentId, cost: parseFloat(cost.toFixed(2)) };
  });

  const recentEntries = costEntries.slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${weekCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projected Monthly</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${projectedMonthly.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <Card>
        <CardHeader><CardTitle>Daily Cost — Last 30 Days</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={last30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + v} />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "6px" }} formatter={(v: unknown) => ["$" + (v as number).toFixed(2), "Cost"]} />
              <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Cost by Model</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => name + " " + ((percent ?? 0) * 100).toFixed(0) + "%"}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={MODEL_COLORS[entry.model] ?? "#6366f1"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: unknown) => ["$" + (v as number).toFixed(2), "Cost"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cost by Agent</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "6px" }} formatter={(v: unknown) => ["$" + (v as number).toFixed(2), "Cost"]} />
                <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries Table */}
      <Card>
        <CardHeader><CardTitle>Recent Cost Entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">Date</th>
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">Agent</th>
                  <th className="text-left text-muted-foreground font-medium px-6 py-3">Model</th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">Input Tokens</th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">Output Tokens</th>
                  <th className="text-right text-muted-foreground font-medium px-6 py-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry, i) => {
                  const agent = agents.find((a) => a.id === entry.agentId);
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-6 py-3 text-muted-foreground">{entry.date}</td>
                      <td className="px-6 py-3">{agent ? agent.emoji + " " + agent.name : entry.agentId}</td>
                      <td className="px-6 py-3 text-muted-foreground">{shortModel(entry.model)}</td>
                      <td className="px-6 py-3 text-right">{entry.inputTokens.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right">{entry.outputTokens.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-medium">${entry.cost.toFixed(3)}</td>
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
