"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Skill } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type SkillFilter = "all" | "installed" | "available";

function sourceBadgeVariant(source: Skill["source"]): "default" | "secondary" | "outline" {
  switch (source) {
    case "bundled":   return "default";
    case "clawhub":  return "secondary";
    case "workspace": return "outline";
  }
}

export default function SkillsPage() {
  const { skills, setSkills, hydrated } = useStore();
  const [filter, setFilter] = useState<SkillFilter>("all");

  const filtered = skills.filter((s) => {
    if (filter === "installed")  return s.installed;
    if (filter === "available") return !s.installed;
    return true;
  });

  function toggleInstall(name: string) {
    setSkills(skills.map((s) => s.name === name ? { ...s, installed: !s.installed } : s));
  }

  const installedCount  = skills.filter((s) => s.installed).length;
  const availableCount  = skills.filter((s) => !s.installed).length;

  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading skills...</p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Package className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No skills found</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Skills will appear here once installed in <code className="bg-muted px-1 rounded">~/.openclaw/workspace/skills/</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Skills</h1>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{installedCount} installed</span>
          <span>|</span>
          <span>{availableCount} available</span>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as SkillFilter)}>
        <TabsList>
          <TabsTrigger value="all">All ({skills.length})</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installedCount})</TabsTrigger>
          <TabsTrigger value="available">Available ({availableCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((skill) => (
          <Card key={skill.name} className={cn(!skill.installed && "opacity-70")}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{skill.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">v{skill.version}</p>
                  </div>
                </div>
                <Badge variant={sourceBadgeVariant(skill.source)} className="shrink-0">{skill.source}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{skill.description}</p>

              {skill.requires && (
                <div className="space-y-1">
                  {skill.requires.bins && skill.requires.bins.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Requires:</span>
                      {skill.requires.bins.map((b) => (
                        <span key={b} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{b}</span>
                      ))}
                    </div>
                  )}
                  {skill.requires.env && skill.requires.env.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Env:</span>
                      {skill.requires.env.map((e) => (
                        <span key={e} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  {skill.installed
                    ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-500">Installed</span></>
                    : <><Circle className="h-3.5 w-3.5 text-zinc-500" /><span className="text-muted-foreground">Not installed</span></>
                  }
                </div>
                <Button
                  variant={skill.installed ? "outline" : "default"}
                  size="sm"
                  onClick={() => toggleInstall(skill.name)}
                >
                  {skill.installed ? "Uninstall" : "Install"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
