"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { gateway, theme, toggleTheme } = useStore();

  const [gatewayAddress, setGatewayAddress] = useState(gateway.address);
  const [authEnabled, setAuthEnabled]       = useState(false);
  const [authToken, setAuthToken]           = useState("");
  const [notifyMissed, setNotifyMissed]     = useState(true);
  const [notifyBudget, setNotifyBudget]     = useState(true);
  const [notifyAgentDown, setNotifyAgentDown] = useState(true);
  const [notifyTask, setNotifyTask]         = useState(false);
  const [saved, setSaved]                   = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Gateway */}
      <Card>
        <CardHeader>
          <CardTitle>Gateway</CardTitle>
          <CardDescription>Connection settings for the OpenClaw gateway.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Gateway Address</Label>
            <Input value={gatewayAddress} onChange={(e) => setGatewayAddress(e.target.value)} placeholder="ws://127.0.0.1:18789" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-xs text-muted-foreground">Current gateway version</p>
            </div>
            <Badge variant="secondary">v{gateway.version}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">Gateway connection state</p>
            </div>
            <Badge variant={gateway.running ? "default" : "destructive"}>
              {gateway.running ? "Running" : "Stopped"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Secure your gateway with a bearer token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Authentication</p>
              <p className="text-xs text-muted-foreground">Require token for all API calls</p>
            </div>
            <Switch checked={authEnabled} onCheckedChange={setAuthEnabled} />
          </div>
          {authEnabled && (
            <div className="space-y-1">
              <Label>Bearer Token</Label>
              <Input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Enter your secret token"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which events trigger alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Missed Payments",  desc: "Alert when a scheduled payment is overdue",   state: notifyMissed,    setter: setNotifyMissed    },
            { label: "Budget Exceeded",   desc: "Alert when daily cost exceeds threshold",      state: notifyBudget,    setter: setNotifyBudget    },
            { label: "Agent Down",        desc: "Alert when an agent goes offline unexpectedly", state: notifyAgentDown, setter: setNotifyAgentDown },
            { label: "Task Completed",    desc: "Alert when any task reaches done or failed",   state: notifyTask,      setter: setNotifyTask      },
          ].map((item, i) => (
            <div key={i}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={item.state} onCheckedChange={item.setter} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of Mission Control.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Currently: {theme === "dark" ? "Dark" : "Light"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === "dark"
                ? <><Sun className="h-4 w-4 mr-1" /> Light Mode</>
                : <><Moon className="h-4 w-4 mr-1" /> Dark Mode</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>Mission Control Version</span><span className="font-mono">0.1.0</span></div>
          <div className="flex justify-between"><span>Gateway Version</span><span className="font-mono">{gateway.version}</span></div>
          <div className="flex justify-between"><span>Framework</span><span className="font-mono">Next.js 16</span></div>
          <div className="flex justify-between"><span>UI</span><span className="font-mono">shadcn/ui + Tailwind v4</span></div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
