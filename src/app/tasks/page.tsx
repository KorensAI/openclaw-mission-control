"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Agent, Task, TaskStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "inbox",       label: "Inbox" },
  { id: "assigned",    label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "review",      label: "Review" },
  { id: "done",        label: "Done" },
  { id: "failed",      label: "Failed" },
];

function priorityColor(p: Task["priority"]): string {
  switch (p) {
    case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high":     return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "medium":   return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:         return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

function TaskCard({ task, agents }: { task: Task; agents: Agent[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const agent = agents.find((a) => a.id === task.assignedAgent);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing"
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={"text-xs px-2 py-0.5 rounded border " + priorityColor(task.priority)}>
          {task.priority}
        </span>
        <span className="text-xs text-muted-foreground">{task.source}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{agent ? agent.emoji + " " + agent.name : "Unassigned"}</span>
        <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { tasks, agents, addTask, moveTask } = useStore();
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle]   = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      description: "",
      status: "inbox",
      priority: newPriority,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    });
    setNewTitle("");
    setDialogOpen(false);
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Task Board</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} id={col.id} className="flex-shrink-0 w-64 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
                <div
                  className="min-h-[400px] rounded-lg border border-dashed border-border bg-muted/20 p-2 space-y-2"
                  data-droppable-id={col.id}
                >
                  <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} agents={agents} />
                    ))}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-lg border border-border bg-card p-3 shadow-lg opacity-90">
              <p className="text-sm font-medium">{activeTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Task["priority"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddTask}>Add Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
