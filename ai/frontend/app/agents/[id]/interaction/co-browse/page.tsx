"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function CoBrowsePage() {
  const params = useParams();
  const agentId = params?.id;
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [controlMode, setControlMode] = useState<"view" | "full">("view");

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8 h-full flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Co-browse Center
              </h1>
              <p className="text-white/60 text-lg">
                Securely assist users by viewing or controlling their browser session in real-time.
              </p>
            </div>
            <Button 
              className={isSessionActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              onClick={() => setIsSessionActive(!isSessionActive)}
            >
              {isSessionActive ? "End Session" : "Start New Session"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
            {/* Control Panel */}
            <Card className="p-6 bg-[#1a1f3a]/80 border-white/10 flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-white/80">Control Mode</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">View</span>
                    <Switch 
                      disabled={!isSessionActive}
                      checked={controlMode === 'full'} 
                      onCheckedChange={(checked) => setControlMode(checked ? 'full' : 'view')} 
                    />
                    <span className="text-xs text-white/40">Full</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <p className="text-xs font-bold text-white/40 uppercase">Session Info</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Status:</span>
                    <Badge variant={isSessionActive ? "default" : "secondary"}>
                      {isSessionActive ? "Connected" : "Idle"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">User:</span>
                    <span className="text-white">Anonymous (ID: 8271)</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <Button variant="outline" className="w-full border-white/10 hover:bg-white/5" disabled={!isSessionActive}>
                  Request Control
                </Button>
                <Button variant="outline" className="w-full border-white/10 hover:bg-white/5" disabled={!isSessionActive}>
                  Mask Sensitive Fields
                </Button>
              </div>
            </Card>

            {/* Mirror Area */}
            <Card className="lg:col-span-3 bg-[#0f1419]/90 border-white/10 relative overflow-hidden flex items-center justify-center">
              {isSessionActive ? (
                <div className="w-full h-full flex items-center justify-center">
                   <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">📡</div>
                    <p className="text-white/40 font-mono">ESTABLISHING DOM MIRRORING...</p>
                   </div>
                   <div className="absolute top-4 left-4 flex gap-2">
                     <Badge className="bg-blue-500">DOM Sync Active</Badge>
                     {controlMode === 'full' && <Badge className="bg-red-500">Full Control Mode</Badge>}
                   </div>
                </div>
              ) : (
                <div className="text-center text-white/10">
                  <div className="text-9xl mb-4">👀</div>
                  <p className="text-2xl font-light">No active session</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
