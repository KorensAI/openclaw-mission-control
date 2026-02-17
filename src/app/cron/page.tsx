"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CronJob } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Play, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function humanSchedule(cron: string): string {
  const presets: Record<string, string> = {
    "0 9 * * *":  "Daily at 9:00 AM",
    "0 10 * * 1": "Every Monday at 10:00 AM",
    "0 2 * * *":  "Daily at 2:00 AM",
    "0 0 1 * *":  "Monthly on the 1st",
    "*/15 * * * *": "Every 15 minutes",
    "0 * * * *":  "Every hour",
  };
  return presets[cron] ?? cron;
}

export default function CronPage() {
  const { cronJobs, setCronJobs, agents, hydrated } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newSchedule, setNewSchedule] = useState("0 9 * * *");
  const [newAgentId, setNewAgentId] = useState("");
  const [newDesc, setNewDesc]       = useState("");

  function toggleJob(id: string) {
    setCronJobs(cronJobs.map((j) => {
      if (j.id !== id) return j;
      return { ...j, status: j.status === "active" ? "paused" : "active" };
    }));
  }

  function addJob() {
    if (!newName.trim() || !newAgentId) return;
    const job: CronJob = {
      id: "cron-" + Date.now(),
      name: newName.trim(),
      schedule: newSchedule,
      agentId: newAgentId,
      nextRun: new Date(Date.now() + 3600000).toISOString(),
      status: "active",
      description: newDesc.trim(),
    };
    setCronJobs([...cronJobs, job]);
    setNewName(""); setNewDesc(""); setNewAgentId("");
    setDialogOpen(false);
  }

  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading cron jobs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cron Jobs</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Job
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Name</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Schedule</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Agent</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Last Run</th>
              <th className="text-left font-medium text-muted-foreground px-5 py-3">Next Run</th>
              <th className="text-center font-medium text-muted-foreground px-5 py-3">Status</th>
              <th className="text-right font-medium text-muted-foreground px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {cronJobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  No cron jobs configured. Add one above or define them in your OpenClaw config.
                </td>
              </tr>
            )}
            {cronJobs.map((job) => {
              const agent = agents.find((a) => a.id === job.agentId);
              return (
                <tr key={job.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium">{job.name}</p>
                      {job.description && <p className="text-xs text-muted-foreground">{job.description}</p>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p>{humanSchedule(job.schedule)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{job.schedule}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {agent ? <span>{agent.emoji} {agent.name}</span> : <span className="text-muted-foreground">{job.agentId}</span>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {job.lastRun ? formatDistanceToNow(new Date(job.lastRun), { addSuffix: true }) : "Never"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant={job.status === "active" ? "default" : job.status === "error" ? "destructive" : "secondary"}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => toggleJob(job.id)}>
                      {job.status === "active" ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Cron Job</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Job name" />
            </div>
            <div className="space-y-1">
              <Label>Schedule (cron expression)</Label>
              <Select value={newSchedule} onValueChange={setNewSchedule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 9 * * *">Daily at 9:00 AM</SelectItem>
                  <SelectItem value="0 10 * * 1">Every Monday at 10:00 AM</SelectItem>
                  <SelectItem value="0 2 * * *">Daily at 2:00 AM</SelectItem>
                  <SelectItem value="0 0 1 * *">Monthly on the 1st</SelectItem>
                  <SelectItem value="0 * * * *">Every hour</SelectItem>
                  <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Agent</Label>
              <Select value={newAgentId} onValueChange={setNewAgentId}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this job do?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={addJob}>Add Job</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
