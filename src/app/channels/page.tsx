"use client";

import { useStore } from "@/lib/store";
import { Channel } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircle, MessageSquare, Hash, Phone, Globe, Radio, Smartphone } from "lucide-react";

function channelIcon(type: Channel["type"]) {
  const cls = "h-8 w-8";
  switch (type) {
    case "telegram":  return <MessageCircle className={cls} />;
    case "discord":   return <Hash className={cls} />;
    case "slack":     return <MessageSquare className={cls} />;
    case "whatsapp":  return <Phone className={cls} />;
    case "webchat":   return <Globe className={cls} />;
    case "signal":    return <Radio className={cls} />;
    case "imessage":  return <Smartphone className={cls} />;
  }
}

function channelColor(type: Channel["type"]): string {
  switch (type) {
    case "telegram":  return "text-sky-400";
    case "discord":   return "text-indigo-400";
    case "slack":     return "text-rose-400";
    case "whatsapp":  return "text-emerald-400";
    case "webchat":   return "text-amber-400";
    case "signal":    return "text-blue-400";
    case "imessage":  return "text-blue-300";
  }
}

export default function ChannelsPage() {
  const { channels, setChannels, hydrated } = useStore();

  function toggleConnection(id: string) {
    setChannels(channels.map((ch) => {
      if (ch.id !== id) return ch;
      return { ...ch, status: ch.status === "connected" ? "disconnected" : "connected" };
    }));
  }

  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading channels...</p>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No channels configured</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Communication channels (Telegram, Discord, Slack, etc.) will appear here once configured in your OpenClaw setup.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Channels</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <Card key={channel.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={cn("p-2 rounded-lg bg-muted", channelColor(channel.type))}>
                  {channelIcon(channel.type)}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      channel.status === "connected"    ? "bg-emerald-500" :
                      channel.status === "error"        ? "bg-red-500"     : "bg-zinc-500"
                    )}
                  />
                  <Badge variant={channel.status === "connected" ? "default" : "outline"}>
                    {channel.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <CardTitle className="text-base">{channel.name}</CardTitle>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{channel.type}</p>
              </div>

              {channel.lastMessage && (
                <p className="text-xs text-muted-foreground truncate border border-border rounded px-2 py-1 bg-muted/30">
                  {channel.lastMessage}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{channel.messageCount} messages</span>
                <Button
                  variant={channel.status === "connected" ? "outline" : "default"}
                  size="sm"
                  onClick={() => toggleConnection(channel.id)}
                >
                  {channel.status === "connected" ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
