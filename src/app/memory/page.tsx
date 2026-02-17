"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  FileText,
  Brain,
  Calendar,
  Users,
  User,
  Database,
  Save,
  X,
  Pencil,
  Clock,
  HardDrive,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MemoryFileInfo {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  category: "core" | "daily";
  size: number;
  lastModified: string;
  content: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "soul.md") return Brain;
  if (lower === "agents.md") return Users;
  if (lower === "user.md") return User;
  if (lower === "memory.md") return Database;
  return Calendar;
}

function getFileBadge(category: "core" | "daily"): { label: string; variant: "default" | "secondary" | "outline" } {
  if (category === "core") return { label: "Core", variant: "default" };
  return { label: "Daily", variant: "secondary" };
}

// ─── Simple Markdown Renderer ───────────────────────────────────────────────

function renderMarkdown(content: string, searchQuery: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeLines: string[] = [];
  let listItems: { level: number; text: string }[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="space-y-1 my-3 ml-4">
        {listItems.map((item, i) => (
          <li key={i} className="text-sm text-foreground/80 leading-relaxed" style={{ marginLeft: `${item.level * 16}px` }}>
            <span className="text-emerald-500 mr-2">-</span>
            {highlightSearch(item.text, searchQuery)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  }

  function highlightSearch(text: string, query: string): React.ReactNode {
    if (!query || query.length < 2) return formatInlineMarkdown(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{formatInlineMarkdown(part)}</span>
          )
        )}
      </>
    );
  }

  function formatInlineMarkdown(text: string): React.ReactNode {
    // Bold
    const boldRegex = /\*\*(.+?)\*\*/g;
    // Inline code
    const codeRegex = /`([^`]+)`/g;
    // Links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const combined = new RegExp(`(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|\\[[^\\]]+\\]\\([^)]+\\))`, "g");
    let match;

    while ((match = combined.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const segment = match[0];
      if (segment.startsWith("**") && segment.endsWith("**")) {
        parts.push(
          <strong key={match.index} className="font-semibold text-foreground">
            {segment.slice(2, -2)}
          </strong>
        );
      } else if (segment.startsWith("`") && segment.endsWith("`")) {
        parts.push(
          <code
            key={match.index}
            className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400"
          >
            {segment.slice(1, -1)}
          </code>
        );
      } else {
        const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(segment);
        if (linkMatch) {
          parts.push(
            <a
              key={match.index}
              href={linkMatch[2]}
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkMatch[1]}
            </a>
          );
        }
      }

      lastIndex = match.index + segment.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        flushList();
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
        codeLines = [];
        continue;
      } else {
        inCodeBlock = false;
        elements.push(
          <div key={`code-${i}`} className="my-3 rounded-lg border border-white/10 overflow-hidden">
            {codeBlockLang && (
              <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-muted-foreground font-mono">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 overflow-x-auto bg-black/30">
              <code className="text-xs font-mono leading-relaxed text-emerald-300/90">
                {codeLines.join("\n")}
              </code>
            </pre>
          </div>
        );
        codeBlockLang = "";
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // List items
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (listMatch) {
      const level = Math.floor(listMatch[1].length / 2);
      listItems.push({ level, text: listMatch[2] });
      continue;
    }

    flushList();

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizes: Record<number, string> = {
        1: "text-xl font-bold mt-6 mb-3 text-foreground",
        2: "text-lg font-semibold mt-5 mb-2 text-foreground",
        3: "text-base font-semibold mt-4 mb-2 text-foreground/90",
        4: "text-sm font-semibold mt-3 mb-1 text-foreground/80",
        5: "text-sm font-medium mt-2 mb-1 text-foreground/70",
        6: "text-xs font-medium mt-2 mb-1 text-foreground/60",
      };
      elements.push(
        <div key={`h-${i}`} className={sizes[level] || sizes[4]}>
          {highlightSearch(text, searchQuery)}
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      elements.push(
        <Separator key={`hr-${i}`} className="my-4 opacity-30" />
      );
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith("> ")) {
      const quoteText = line.trimStart().slice(2);
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-2 border-indigo-500/50 pl-3 py-1 my-2 text-sm text-muted-foreground italic"
        >
          {highlightSearch(quoteText, searchQuery)}
        </blockquote>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm text-foreground/80 leading-relaxed my-1">
        {highlightSearch(line, searchQuery)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-0">{elements}</div>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const { hydrated } = useStore();
  const [files, setFiles] = useState<MemoryFileInfo[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [sidebarCategory, setSidebarCategory] = useState<"all" | "core" | "daily">("all");

  // Fetch memory files from API
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/memory/files");
      if (res.ok) {
        const data: MemoryFileInfo[] = await res.json();
        setFiles(data);
        // Auto-select first file if none selected
        if (data.length > 0 && !selectedFileId) {
          setSelectedFileId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch memory files:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFileId]);

  useEffect(() => {
    if (hydrated) {
      fetchFiles();
    }
  }, [hydrated, fetchFiles]);

  // Selected file
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) ?? null,
    [files, selectedFileId]
  );

  // Filtered files for sidebar
  const filteredFiles = useMemo(() => {
    let filtered = files;

    if (sidebarCategory !== "all") {
      filtered = filtered.filter((f) => f.category === sidebarCategory);
    }

    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.content.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [files, sidebarCategory, searchQuery]);

  // Core files first, then daily (newest first)
  const sortedFiles = useMemo(() => {
    const core = filteredFiles.filter((f) => f.category === "core");
    const daily = filteredFiles.filter((f) => f.category === "daily");
    return [...core, ...daily];
  }, [filteredFiles]);

  // Search match count per file
  const searchMatchCounts = useMemo(() => {
    if (searchQuery.length < 2) return {};
    const q = searchQuery.toLowerCase();
    const counts: Record<string, number> = {};
    for (const f of files) {
      const matches = f.content.toLowerCase().split(q).length - 1;
      if (matches > 0) counts[f.id] = matches;
    }
    return counts;
  }, [files, searchQuery]);

  function handleSelectFile(fileId: string) {
    if (isEditing) {
      const confirmed = window.confirm(
        "You have unsaved changes. Discard them?"
      );
      if (!confirmed) return;
    }
    setSelectedFileId(fileId);
    setIsEditing(false);
    setSaveStatus("idle");
  }

  function handleStartEditing() {
    if (!selectedFile) return;
    setEditContent(selectedFile.content);
    setIsEditing(true);
    setSaveStatus("idle");
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setEditContent("");
    setSaveStatus("idle");
  }

  async function handleSave() {
    if (!selectedFile) return;
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch("/api/memory/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: selectedFile.relativePath,
          content: editContent,
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
        setIsEditing(false);
        // Refresh files to get updated content and metadata
        await fetchFiles();
        // Brief success indicator
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        const err = await res.json();
        console.error("Save failed:", err);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (!hydrated || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading memory files...
          </p>
        </div>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Brain className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No memory files found</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Memory files will appear here when your OpenClaw workspace has SOUL.md,
          USER.md, AGENTS.md, MEMORY.md, or daily memory files in{" "}
          <code className="bg-muted px-1 rounded text-xs">
            ~/.openclaw/workspace/
          </code>
        </p>
      </div>
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Memory Viewer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse and edit your agent memory files
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search across all memory files..."
          className="pl-9 bg-white/[0.03] border-white/10"
        />
        {searchQuery.length >= 2 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""} matched
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 h-[calc(100vh-260px)]">
        {/* ─── Sidebar: file browser ─────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-white/[0.06] text-xs">
            {(["all", "core", "daily"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSidebarCategory(cat)}
                className={`flex-1 px-3 py-2.5 capitalize transition-colors ${
                  sidebarCategory === cat
                    ? "text-foreground bg-white/[0.05] font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                }`}
              >
                {cat}
                <span className="ml-1.5 text-muted-foreground">
                  {cat === "all"
                    ? files.length
                    : files.filter((f) => f.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* File list */}
          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              {sortedFiles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No files match your search.
                </div>
              )}
              {sortedFiles.map((file) => {
                const Icon = getFileIcon(file.name);
                const badge = getFileBadge(file.category);
                const isSelected = file.id === selectedFileId;
                const matchCount = searchMatchCounts[file.id];

                return (
                  <button
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    className={`w-full text-left rounded-md px-3 py-2.5 transition-all group ${
                      isSelected
                        ? "bg-white/[0.08] border border-white/[0.1]"
                        : "hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 flex-shrink-0 ${
                          isSelected
                            ? "text-emerald-400"
                            : "text-muted-foreground group-hover:text-foreground/70"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm truncate ${
                              isSelected
                                ? "font-medium text-foreground"
                                : "text-foreground/80"
                            }`}
                          >
                            {file.name}
                          </span>
                          {matchCount && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {matchCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">
                            |
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(file.lastModified).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* ─── Content viewer / editor ───────────────────────────────────── */}
        <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden min-w-0">
          {selectedFile ? (
            <>
              {/* File header bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const Icon = getFileIcon(selectedFile.name);
                    return <Icon className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {selectedFile.name}
                      </span>
                      <Badge
                        variant={getFileBadge(selectedFile.category).variant}
                        className="text-[10px] py-0 h-4"
                      >
                        {getFileBadge(selectedFile.category).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatFileSize(selectedFile.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(selectedFile.lastModified)}
                      </span>
                      <span className="text-muted-foreground/50">
                        {selectedFile.relativePath}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saveStatus === "success" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 animate-fade-in">
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-1 text-xs text-red-400 animate-fade-in">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  )}

                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditing}
                        className="h-8 text-xs"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEditing}
                      className="h-8 text-xs border-white/10 hover:bg-white/[0.05]"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Content area */}
              <ScrollArea className="flex-1">
                {isEditing ? (
                  <div className="p-4">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[calc(100vh-380px)] font-mono text-sm bg-black/20 border-white/10 resize-none leading-relaxed"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="p-5">
                    {renderMarkdown(selectedFile.content, searchQuery)}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a file from the sidebar to view its contents
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
