"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Agent, Task, TaskStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  GripVertical,
  Clock,
  Tag,
  User2,
  Pencil,
  Check,
  X,
  Inbox,
  UserCheck,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Column config ──────────────────────────────────────────────────────────

const COLUMNS: {
  id: TaskStatus;
  label: string;
  icon: React.ElementType;
  gradient: string;
  dotColor: string;
}[] = [
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    gradient: "from-zinc-500/20 to-zinc-600/10",
    dotColor: "bg-zinc-400",
  },
  {
    id: "assigned",
    label: "Assigned",
    icon: UserCheck,
    gradient: "from-blue-500/20 to-blue-600/10",
    dotColor: "bg-blue-400",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: Loader2,
    gradient: "from-amber-500/20 to-amber-600/10",
    dotColor: "bg-amber-400",
  },
  {
    id: "review",
    label: "Review",
    icon: Eye,
    gradient: "from-violet-500/20 to-violet-600/10",
    dotColor: "bg-violet-400",
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    gradient: "from-emerald-500/20 to-emerald-600/10",
    dotColor: "bg-emerald-400",
  },
  {
    id: "failed",
    label: "Failed",
    icon: XCircle,
    gradient: "from-red-500/20 to-red-600/10",
    dotColor: "bg-red-400",
  },
];

// ─── Priority styling ───────────────────────────────────────────────────────

function priorityStyle(p: Task["priority"]): {
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  switch (p) {
    case "critical":
      return {
        bg: "bg-gradient-to-r from-red-500/20 to-rose-500/20",
        text: "text-red-300",
        border: "border-red-500/30",
        glow: "shadow-[0_0_8px_rgba(239,68,68,0.15)]",
      };
    case "high":
      return {
        bg: "bg-gradient-to-r from-orange-500/20 to-amber-500/20",
        text: "text-orange-300",
        border: "border-orange-500/30",
        glow: "shadow-[0_0_8px_rgba(249,115,22,0.1)]",
      };
    case "medium":
      return {
        bg: "bg-gradient-to-r from-blue-500/15 to-indigo-500/15",
        text: "text-blue-300",
        border: "border-blue-500/25",
        glow: "",
      };
    default:
      return {
        bg: "bg-zinc-800/50",
        text: "text-zinc-400",
        border: "border-zinc-700/50",
        glow: "",
      };
  }
}

// ─── TaskCard ───────────────────────────────────────────────────────────────

function TaskCard({
  task,
  agents,
  onUpdate,
}: {
  task: Task;
  agents: Agent[];
  onUpdate: (id: string, data: Partial<Task>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const agent = agents.find((a) => a.id === task.assignedAgent);
  const priority = priorityStyle(task.priority);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  function saveEdit() {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdate(task.id, { title: editTitle.trim() });
    }
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-card rounded-lg p-3.5 space-y-2.5 group transition-all duration-200 hover:bg-white/[0.04] ${priority.glow} ${isDragging ? "ring-1 ring-white/10" : ""}`}
    >
      {/* Drag handle + title */}
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") {
                    setEditTitle(task.title);
                    setEditing(false);
                  }
                }}
                className="h-6 text-xs bg-transparent border-zinc-700 px-1.5"
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={saveEdit}
                className="h-5 w-5 text-emerald-400 hover:text-emerald-300"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setEditTitle(task.title);
                  setEditing(false);
                }}
                className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium leading-snug text-zinc-200 group-hover:text-white transition-colors">
              {task.title}
              <button
                onClick={() => setEditing(true)}
                className="inline-flex ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="h-2.5 w-2.5 text-zinc-600 hover:text-zinc-400" />
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Priority + source */}
      <div className="flex items-center justify-between gap-2 pl-5">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${priority.bg} ${priority.text} ${priority.border}`}
        >
          {task.priority}
        </span>
        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
          <Tag className="h-2.5 w-2.5" />
          {task.source}
        </span>
      </div>

      {/* Agent + time */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 pl-5">
        <span className="flex items-center gap-1.5">
          {agent ? (
            <>
              <span>{agent.emoji}</span>
              <span className="text-zinc-400">{agent.name}</span>
            </>
          ) : (
            <>
              <User2 className="h-3 w-3 text-zinc-600" />
              <span className="text-zinc-600">Unassigned</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500 border border-zinc-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { tasks, agents, addTask, updateTask, moveTask, hydrated } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [newAgent, setNewAgent] = useState<string>("unassigned");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (!overId || !activeId) return;
    const isColumn = COLUMNS.some((c) => c.id === overId);
    if (isColumn) moveTask(activeId, overId as TaskStatus);
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (overId && activeId) {
      const isColumn = COLUMNS.some((c) => c.id === overId);
      if (isColumn) moveTask(activeId, overId as TaskStatus);
    }
    setActiveId(null);
  }

  function handleAddTask() {
    if (!newTitle.trim()) return;
    addTask({
      id: "task-" + Date.now(),
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: newAgent !== "unassigned" ? "assigned" : "inbox",
      priority: newPriority,
      assignedAgent: newAgent !== "unassigned" ? newAgent : undefined,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    });
    setNewTitle("");
    setNewDescription("");
    setNewPriority("medium");
    setNewAgent("unassigned");
    setDialogOpen(false);
  }

  function handleUpdateTask(id: string, data: Partial<Task>) {
    updateTask(id, { ...data, updatedAt: new Date().toISOString() });
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-zinc-500 animate-fade-in">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading task board...</span>
        </div>
      </div>
    );
  }

  const totalTasks = tasks.length;

  return (
    <div className="space-y-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Task Board
          </h1>
          <Badge
            variant="secondary"
            className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700"
          >
            {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-emerald-500/10 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </Button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 px-6 custom-scrollbar">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            const Icon = col.icon;
            return (
              <div
                key={col.id}
                id={col.id}
                className="flex-shrink-0 w-72 space-y-3 animate-fade-up"
              >
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r ${col.gradient}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                    <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      {col.label}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] bg-black/20 text-zinc-400 border-white/5"
                  >
                    {colTasks.length}
                  </Badge>
                </div>

                {/* Droppable zone */}
                <div
                  className="min-h-[450px] rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] p-2 space-y-2 transition-colors"
                  data-droppable-id={col.id}
                >
                  <SortableContext
                    items={colTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {colTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                        <Icon className="h-6 w-6 mb-2 opacity-30" />
                        <p className="text-[11px]">Drop tasks here</p>
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          agents={agents}
                          onUpdate={handleUpdateTask}
                        />
                      ))
                    )}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-lg border border-white/10 bg-zinc-900/95 backdrop-blur-md p-3.5 shadow-2xl shadow-black/50 w-72">
              <p className="text-sm font-medium text-white">{activeTask.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${priorityStyle(activeTask.priority).bg} ${priorityStyle(activeTask.priority).text} ${priorityStyle(activeTask.priority).border}`}
                >
                  {activeTask.priority}
                </span>
                <span className="text-[10px] text-zinc-500">{activeTask.source}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* New Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional details..."
                className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Priority</Label>
                <Select
                  value={newPriority}
                  onValueChange={(v) =>
                    setNewPriority(v as Task["priority"])
                  }
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-zinc-500" />
                        Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        High
                      </span>
                    </SelectItem>
                    <SelectItem value="critical">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Critical
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Assign Agent</Label>
                <Select
                  value={newAgent}
                  onValueChange={setNewAgent}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span>{a.emoji}</span>
                          {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-zinc-800 text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddTask}
                disabled={!newTitle.trim()}
                className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white border-0"
              >
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
