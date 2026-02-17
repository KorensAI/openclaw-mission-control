"use client";

import { useState, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Bot,
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  Pencil,
  Trash2,
  Activity,
  Zap,
  DollarSign,
  Clock,
  Sparkles,
  CircleDot,
  Terminal,
  Eye,
} from "lucide-react";
import type { Agent } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "Anthropic" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4", provider: "Anthropic" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4", provider: "Anthropic" },
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { value: "o3", label: "o3", provider: "OpenAI" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { value: "deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek" },
  { value: "llama-4-maverick", label: "Llama 4 Maverick", provider: "Meta" },
];

const AVAILABLE_CAPABILITIES = [
  { id: "code-review", label: "Code Review", description: "Review pull requests and code changes" },
  { id: "task-execution", label: "Task Execution", description: "Execute tasks from the task board" },
  { id: "telegram", label: "Telegram", description: "Interact via Telegram messages" },
  { id: "discord", label: "Discord", description: "Interact via Discord channels" },
  { id: "cron", label: "Cron Jobs", description: "Run scheduled automated tasks" },
  { id: "web-browsing", label: "Web Browsing", description: "Browse and scrape web content" },
  { id: "file-system", label: "File System", description: "Read and write local files" },
  { id: "git", label: "Git Operations", description: "Commit, branch, and manage repos" },
  { id: "shell", label: "Shell Commands", description: "Execute terminal commands" },
  { id: "memory", label: "Long-term Memory", description: "Persist context across sessions" },
  { id: "api-calls", label: "API Calls", description: "Make HTTP requests to external APIs" },
  { id: "image-gen", label: "Image Generation", description: "Generate images with AI models" },
];

const EMOJI_PICKS = [
  "🤖", "🧠", "🦞", "🐙", "🦊", "🐺", "🦅", "🐲",
  "🔮", "⚡", "🌊", "🔥", "💎", "🛡️", "🎯", "🚀",
  "👾", "🤡", "🥷", "🧙", "🧑‍💻", "👁️", "🌀", "☄️",
  "🎭", "🏴‍☠️", "🦾", "🧬", "💫", "🪐", "🌋", "🗡️",
];

const WIZARD_STEPS = [
  { id: 1, title: "Identity", description: "Name and persona" },
  { id: 2, title: "Model", description: "AI model selection" },
  { id: 3, title: "Capabilities", description: "Skills and tools" },
  { id: 4, title: "Review", description: "Confirm and create" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  name: string;
  emoji: string;
  description: string;
  model: string;
  capabilities: string[];
}

const emptyWizard: WizardState = {
  name: "",
  emoji: "🤖",
  description: "",
  model: "claude-sonnet-4-20250514",
  capabilities: [],
};

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusDot(status: Agent["status"]): string {
  switch (status) {
    case "online":  return "bg-emerald-400";
    case "busy":    return "bg-amber-400";
    case "error":   return "bg-red-400";
    default:        return "bg-zinc-500";
  }
}

function statusBg(status: Agent["status"]): string {
  switch (status) {
    case "online":  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "busy":    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "error":   return "bg-red-500/10 text-red-400 border-red-500/20";
    default:        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {WIZARD_STEPS.map((step, i) => {
        const isComplete = currentStep > step.id;
        const isCurrent = currentStep === step.id;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={`
                  h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  transition-all duration-300
                  ${isComplete
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-white/10 text-white border border-white/20 ring-2 ring-emerald-500/30"
                      : "bg-white/[0.04] text-zinc-600 border border-white/[0.06]"
                  }
                `}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : step.id}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className={`text-xs font-medium truncate ${isCurrent ? "text-white" : "text-zinc-500"}`}>
                  {step.title}
                </p>
                <p className="text-[10px] text-zinc-600 truncate">{step.description}</p>
              </div>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-2 transition-colors duration-300 ${isComplete ? "bg-emerald-500/50" : "bg-white/[0.06]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function StepIdentity({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (update: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Emoji Picker */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-300">Avatar Emoji</Label>
        <div className="grid grid-cols-8 gap-1.5">
          {EMOJI_PICKS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ emoji })}
              className={`
                h-10 w-full rounded-lg text-xl flex items-center justify-center transition-all duration-200
                ${state.emoji === emoji
                  ? "bg-white/10 ring-2 ring-emerald-500/50 scale-110"
                  : "bg-white/[0.03] hover:bg-white/[0.06] hover:scale-105"
                }
              `}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="agent-name" className="text-sm text-zinc-300">
          Agent Name
        </Label>
        <Input
          id="agent-name"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Atlas, Sentinel, Hermes..."
          className="bg-white/[0.04] border-white/[0.08] focus:border-emerald-500/50 h-11"
          maxLength={32}
        />
        <p className="text-[11px] text-zinc-600">
          A short, memorable name for your agent. {32 - state.name.length} characters remaining.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="agent-desc" className="text-sm text-zinc-300">
          Description
        </Label>
        <Textarea
          id="agent-desc"
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe what this agent does and its role in your fleet..."
          className="bg-white/[0.04] border-white/[0.08] focus:border-emerald-500/50 min-h-24 resize-none"
          maxLength={256}
        />
        <p className="text-[11px] text-zinc-600">
          {256 - state.description.length} characters remaining.
        </p>
      </div>

      {/* Preview */}
      <div className="glass-card rounded-xl p-4 mt-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Preview</p>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/[0.06] flex items-center justify-center text-2xl">
            {state.emoji}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">
              {state.name || "Unnamed Agent"}
            </p>
            <p className="text-xs text-zinc-500 line-clamp-1">
              {state.description || "No description yet"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Model ────────────────────────────────────────────────────────────

function StepModel({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (update: Partial<WizardState>) => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, typeof AVAILABLE_MODELS> = {};
    for (const m of AVAILABLE_MODELS) {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    }
    return groups;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Label className="text-sm text-zinc-300">Select Model</Label>
        <Select
          value={state.model}
          onValueChange={(v) => onChange({ model: v })}
        >
          <SelectTrigger className="w-full bg-white/[0.04] border-white/[0.08] h-11">
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(grouped).map(([provider, models]) => (
              <div key={provider}>
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  {provider}
                </div>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-zinc-500 text-xs ml-2 font-mono">{m.value}</span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model cards */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600">Or click to select</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ model: m.value })}
              className={`
                text-left p-3 rounded-lg transition-all duration-200 border
                ${state.model === m.value
                  ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                }
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{m.label}</span>
                {state.model === m.value && (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-500">{m.value}</p>
              <Badge variant="outline" className="mt-1.5 text-[10px] border-white/[0.08] text-zinc-500">
                {m.provider}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Capabilities ─────────────────────────────────────────────────────

function StepCapabilities({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (update: Partial<WizardState>) => void;
}) {
  const toggleCapability = useCallback(
    (capId: string) => {
      const current = state.capabilities;
      const next = current.includes(capId)
        ? current.filter((c) => c !== capId)
        : [...current, capId];
      onChange({ capabilities: next });
    },
    [state.capabilities, onChange]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-zinc-300">Agent Capabilities</Label>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            Select what this agent can do. {state.capabilities.length} selected.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] text-zinc-400 hover:text-white"
            onClick={() => onChange({ capabilities: AVAILABLE_CAPABILITIES.map((c) => c.id) })}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="text-[11px] text-zinc-400 hover:text-white"
            onClick={() => onChange({ capabilities: [] })}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
        {AVAILABLE_CAPABILITIES.map((cap) => {
          const selected = state.capabilities.includes(cap.id);
          return (
            <button
              key={cap.id}
              type="button"
              onClick={() => toggleCapability(cap.id)}
              className={`
                text-left p-3 rounded-lg transition-all duration-200 border flex items-start gap-3
                ${selected
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                }
              `}
            >
              <div
                className={`
                  h-5 w-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all
                  ${selected
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-white/[0.15] bg-white/[0.03]"
                  }
                `}
              >
                {selected && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{cap.label}</p>
                <p className="text-[11px] text-zinc-500 line-clamp-1">{cap.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function StepReview({
  state,
  copied,
  onCopy,
}: {
  state: WizardState;
  copied: boolean;
  onCopy: () => void;
}) {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.value === state.model);
  const selectedCaps = AVAILABLE_CAPABILITIES.filter((c) =>
    state.capabilities.includes(c.id)
  );

  const agentJson = useMemo(() => {
    return JSON.stringify(
      {
        id: state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: state.name,
        emoji: state.emoji,
        model: state.model,
        description: state.description,
        capabilities: state.capabilities,
      },
      null,
      2
    );
  }, [state]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Agent Preview Card */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 flex items-center justify-center text-3xl shrink-0">
            {state.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white">{state.name || "Unnamed"}</h3>
            <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
              {state.description || "No description"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-400">
                {selectedModel?.label ?? state.model}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-400">
                {selectedCaps.length} capabilities
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities list */}
      {selectedCaps.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
            Capabilities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCaps.map((cap) => (
              <Badge key={cap.id} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {cap.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* JSON Config */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Agent Configuration (JSON)
          </p>
          <Button
            variant="ghost"
            size="xs"
            onClick={onCopy}
            className="text-[11px] text-zinc-400 hover:text-white gap-1"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
        </div>
        <pre className="bg-black/40 border border-white/[0.06] rounded-lg p-4 text-xs text-emerald-300 font-mono overflow-x-auto custom-scrollbar">
          {agentJson}
        </pre>
      </div>

      {/* CLI Instructions */}
      <div className="glass-card rounded-lg p-4 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Terminal className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300 mb-1">CLI Setup</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Copy the JSON above and run the following command to register this agent:
            </p>
            <code className="block mt-2 bg-black/40 rounded px-3 py-2 text-xs font-mono text-zinc-300">
              openclaw agent add --config &apos;{`{...}`}&apos;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Detail Dialog ──────────────────────────────────────────────────────

function AgentDetailDialog({
  agent,
  open,
  onClose,
}: {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <span className="text-2xl">{agent.emoji}</span>
            {agent.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Agent configuration and live stats
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Status</span>
            <Badge className={`text-[10px] font-medium border ${statusBg(agent.status)}`}>
              {agent.status}
            </Badge>
          </div>

          {/* Model */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Model</span>
            <span className="text-sm font-mono text-zinc-300">{agent.model}</span>
          </div>

          {/* Sessions */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Sessions Today</span>
            <span className="text-sm font-medium text-white">{agent.sessionsToday}</span>
          </div>

          {/* Tokens */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Tokens Used</span>
            <span className="text-sm font-medium text-white">
              {agent.tokensUsed >= 1000
                ? `${(agent.tokensUsed / 1000).toFixed(1)}K`
                : agent.tokensUsed}
            </span>
          </div>

          {/* Cost */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Cost Today</span>
            <span className="text-sm font-medium text-emerald-400">
              ${agent.costToday.toFixed(4)}
            </span>
          </div>

          {/* Last active */}
          {agent.lastActive && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Last Active</span>
              <span className="text-sm text-zinc-300">
                {new Date(agent.lastActive).toLocaleString()}
              </span>
            </div>
          )}

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <div>
              <span className="text-sm text-zinc-400 block mb-2">Capabilities</span>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <Badge
                    key={cap}
                    variant="outline"
                    className="text-[10px] border-white/[0.08] text-zinc-400"
                  >
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="border-zinc-700">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Card ──────────────────────────────────────────────────────────────

function AgentListCard({
  agent,
  index,
  onView,
  onDelete,
}: {
  agent: Agent;
  index: number;
  onView: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}) {
  return (
    <div
      className="glass-card rounded-xl p-5 group hover:bg-white/[0.05] transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] flex items-center justify-center text-xl">
              {agent.emoji}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${statusDot(agent.status)} ${agent.status === "online" ? "animate-live-pulse" : ""}`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">{agent.name}</h3>
            <p className="text-[11px] text-zinc-500 font-mono">{agent.model}</p>
          </div>
        </div>
        <Badge className={`text-[10px] font-medium border ${statusBg(agent.status)}`}>
          {agent.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 mb-1">
            <Activity className="h-3 w-3" />
            <span className="text-[10px]">Sessions</span>
          </div>
          <p className="text-sm font-semibold text-white">{agent.sessionsToday}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 mb-1">
            <Zap className="h-3 w-3" />
            <span className="text-[10px]">Tokens</span>
          </div>
          <p className="text-sm font-semibold text-white">
            {agent.tokensUsed >= 1000 ? `${(agent.tokensUsed / 1000).toFixed(0)}K` : agent.tokensUsed}
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 mb-1">
            <DollarSign className="h-3 w-3" />
            <span className="text-[10px]">Cost</span>
          </div>
          <p className="text-sm font-semibold text-emerald-400">${agent.costToday.toFixed(4)}</p>
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <Badge
              key={cap}
              variant="outline"
              className="text-[9px] border-white/[0.06] text-zinc-500 px-1.5 py-0"
            >
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 3 && (
            <Badge variant="outline" className="text-[9px] border-white/[0.06] text-zinc-500 px-1.5 py-0">
              +{agent.capabilities.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Last active */}
      {agent.lastActive && (
        <p className="text-[11px] text-zinc-600 mb-3 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {new Date(agent.lastActive).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.06]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                onClick={() => onView(agent)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View details</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => onDelete(agent)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete agent</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="xs"
          className="text-zinc-400 hover:text-white text-[11px] gap-1"
          onClick={() => onView(agent)}
        >
          Details
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { agents, hydrated } = useStore();

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({ ...emptyWizard });
  const [copied, setCopied] = useState(false);

  // Detail dialog
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Delete confirm
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateWizard = useCallback(
    (update: Partial<WizardState>) => {
      setWizardState((prev) => ({ ...prev, ...update }));
    },
    []
  );

  const openWizard = useCallback(() => {
    setWizardState({ ...emptyWizard });
    setWizardStep(1);
    setCopied(false);
    setWizardOpen(true);
  }, []);

  const canProceed = useMemo(() => {
    switch (wizardStep) {
      case 1: return wizardState.name.trim().length >= 2;
      case 2: return wizardState.model.length > 0;
      case 3: return true; // capabilities are optional
      case 4: return true;
      default: return false;
    }
  }, [wizardStep, wizardState]);

  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(
      {
        id: wizardState.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: wizardState.name,
        emoji: wizardState.emoji,
        model: wizardState.model,
        description: wizardState.description,
        capabilities: wizardState.capabilities,
      },
      null,
      2
    );
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [wizardState]);

  const handleViewAgent = useCallback((agent: Agent) => {
    setDetailAgent(agent);
    setDetailOpen(true);
  }, []);

  const handleDeleteAgent = useCallback((agent: Agent) => {
    setDeleteAgent(agent);
    setDeleteOpen(true);
  }, []);

  // Loading
  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 -m-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Agent Fleet
          </h1>
          <Badge variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button
          onClick={openWizard}
          className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Agent</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* ── Stats Summary ────────────────────────────────────────────────── */}
      {agents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6">
          {[
            {
              label: "Total Agents",
              value: agents.length,
              icon: Bot,
              gradient: "from-indigo-500/20 to-violet-500/20",
            },
            {
              label: "Online",
              value: agents.filter((a) => a.status === "online" || a.status === "busy").length,
              icon: CircleDot,
              gradient: "from-emerald-500/20 to-teal-500/20",
            },
            {
              label: "Total Sessions",
              value: agents.reduce((s, a) => s + a.sessionsToday, 0),
              icon: Activity,
              gradient: "from-amber-500/20 to-orange-500/20",
            },
            {
              label: "Total Cost",
              value: `$${agents.reduce((s, a) => s + a.costToday, 0).toFixed(4)}`,
              icon: DollarSign,
              gradient: "from-violet-500/20 to-purple-500/20",
            },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-md bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className="h-3.5 w-3.5 text-zinc-300" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </span>
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Agent Grid ───────────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        {agents.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <div className="relative mx-auto w-fit mb-4">
              <Sparkles className="h-10 w-10 text-zinc-600" />
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 rounded-full blur-xl -z-10" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No agents yet</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              Create your first AI agent to get started. Agents can review code, execute tasks,
              respond to messages, and much more.
            </p>
            <Button onClick={openWizard} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
              <Plus className="h-4 w-4" />
              Create Your First Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <AgentListCard
                key={agent.id}
                agent={agent}
                index={i}
                onView={handleViewAgent}
                onDelete={handleDeleteAgent}
              />
            ))}

            {/* Add new agent card */}
            <button
              onClick={openWizard}
              className="glass-card rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[200px] hover:bg-white/[0.04] border-dashed border-white/[0.08] transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-xl bg-white/[0.04] group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                <Plus className="h-5 w-5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-sm font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Add Agent
              </p>
            </button>
          </div>
        )}
      </div>

      {/* ── Create Agent Wizard Dialog ────────────────────────────────────── */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 flex items-center justify-center">
                <Bot className="h-4 w-4 text-emerald-400" />
              </div>
              Create New Agent
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Configure your new AI agent step by step.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
            <StepIndicator currentStep={wizardStep} />

            {wizardStep === 1 && (
              <StepIdentity state={wizardState} onChange={updateWizard} />
            )}
            {wizardStep === 2 && (
              <StepModel state={wizardState} onChange={updateWizard} />
            )}
            {wizardStep === 3 && (
              <StepCapabilities state={wizardState} onChange={updateWizard} />
            )}
            {wizardStep === 4 && (
              <StepReview state={wizardState} copied={copied} onCopy={handleCopyJson} />
            )}
          </div>

          <DialogFooter className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex-1">
              {wizardStep > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setWizardStep((s) => s - 1)}
                  className="gap-1 text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setWizardOpen(false)}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              {wizardStep < 4 ? (
                <Button
                  onClick={() => setWizardStep((s) => s + 1)}
                  disabled={!canProceed}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    handleCopyJson();
                    setWizardOpen(false);
                  }}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Copy className="h-4 w-4" />
                  Copy Config & Close
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Agent Detail Dialog ──────────────────────────────────────────── */}
      <AgentDetailDialog
        agent={detailAgent}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* ── Delete Confirm Dialog ────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Agent</DialogTitle>
            <DialogDescription className="text-zinc-500">
              This will generate a removal command for{" "}
              <span className="text-white font-medium">{deleteAgent?.name}</span>.
              The agent must be removed via the OpenClaw CLI.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <code className="block bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono text-zinc-300">
              openclaw agent remove {deleteAgent?.id}
            </code>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteAgent) {
                  navigator.clipboard.writeText(`openclaw agent remove ${deleteAgent.id}`);
                }
                setDeleteOpen(false);
              }}
            >
              <Copy className="h-4 w-4" />
              Copy Command
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
