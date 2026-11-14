"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { toast } from "react-hot-toast";

interface ExecutionLog {
  id: string;
  type: "status" | "info" | "error" | "success";
  message: string;
  timestamp: Date;
}

export default function BrowserStudioPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const { token } = useAuthStore();
  
  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState<"deterministic" | "agent" | "hybrid">("deterministic");
  const [hardware, setHardware] = useState("basic");
  const [aiThreshold, setAiThreshold] = useState(0.7); // Confidence threshold for AI healing
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [castFrame, setCastFrame] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    if (!sessionId) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8001';

    // Connect to Status Socket
    const statusWs = new WebSocket(`${wsBase}/ws/execution/${sessionId}/status`);
    statusWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.event === "HUEMN_RECORD_STEP") {
        setRecordedSteps((prev) => [...prev, data.data.step]);
        addLog(`Step captured via extension: ${data.data.step.type}`, "info");
      } 
      else if (data.event === "HUEMN_RECORDING_STARTED") {
        setIsRecording(true);
        setRecordedSteps([]);
        addLog("Extension recording started.", "status");
      }
      else if (data.event === "HUEMN_RECORDING_STOPPED") {
        setIsRecording(false);
        if (data.data.workflow?.steps) {
          setRecordedSteps(data.data.workflow.steps);
        }
        addLog("Extension recording stopped.", "success");
      }
      else if (data.event === "step_start") {
        addLog(`Executing: ${data.data.step.type} ${data.data.step.selector || ''}`, "status");
      }
      else if (data.event === "step_completed") {
        addLog(`Completed step ${data.data.index + 1}`, "success");
      }
      else if (data.event === "step_failed") {
        addLog(`Failed: ${data.data.error}`, "error");
      }
      else if (data.event === "self_healing_triggered") {
        addLog(`⚠️ Element not found. Triggering AI Self-healing...`, "info");
      }
      else if (data.event === "healing_action_attempt") {
        addLog(`🤖 AI suggesting alternative: ${data.data.new_action.action} on ${data.data.new_action.selector}`, "info");
      }
      else if (data.event === "automation_finished") {
        setIsExecuting(false);
        addLog("Automation workflow finished.", "success");
      }
      else {
        addLog(data.data?.message || data.event, data.type || "info");
      }
    };

    // Connect to Cast Socket
    const castWs = new WebSocket(`${wsBase}/ws/execution/${sessionId}/cast`);
    castWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "frame") {
          setCastFrame(data.data);
        } else if (data.type === "recording_indicator") {
            // Optional: show red dot
        }
      } catch (e) {
        // Handle non-JSON frame data if any
      }
    };

    return () => {
      statusWs.close();
      castWs.close();
    };
  }, [sessionId]);

  const addLog = (message: string, type: ExecutionLog["type"] = "info") => {
    setLogs((prev) => [
      { id: Math.random().toString(36).substr(2, 9), message, type, timestamp: new Date() },
      ...prev,
    ]);
  };

  const handleExecute = async () => {
    if (!instruction.trim() || isExecuting) return;
    
    setIsExecuting(true);
    setLogs([]);
    addLog(`Requesting headless execution for ${mode.toUpperCase()} engine...`, "status");
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/orchestrator/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_id: agentId,
          session_id: sessionId,
          node_type: "hil_automation",
          config: {
            mode: mode,
            instruction: instruction,
            hardware: hardware,
            ai_threshold: aiThreshold,
            workflow: recordedSteps.length > 0 ? { steps: recordedSteps, name: "Studio Workflow" } : null
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        addLog(`Execution failed to start: ${err.detail || 'Unknown error'}`, "error");
        setIsExecuting(false);
      }
    } catch (err) {
      addLog("Network error while starting execution.", "error");
      setIsExecuting(false);
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      addLog("Please stop recording using the Huemn Chrome Extension.", "info");
    } else {
      addLog("To start recording: 1. Open your target website. 2. Click 'Start Recording' in the Huemn Chrome Extension.", "status");
      addLog("Steps will appear here in real-time as you perform them in the browser.", "info");
    }
  };

  const handleSave = async () => {
    if (recordedSteps.length === 0) return;
    
    addLog("Saving workflow to Agent Database...", "status");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/agents/${agentId}/nodes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          node_type: "hil_automation",
          name: "Browser Automation",
          config: {
            mode: mode,
            instruction: instruction,
            workflow: { steps: recordedSteps, name: "Studio Workflow" }
          }
        })
      });

      if (response.ok) {
        addLog("Workflow saved and published to agent flow!", "success");
        toast.success("Workflow saved successfully!");
      } else {
        const err = await response.json();
        addLog(`Failed to save workflow: ${err.detail || 'Unknown error'}`, "error");
        toast.error("Failed to save workflow");
      }
    } catch (err) {
      addLog("Network error while saving workflow.", "error");
      toast.error("Network error");
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const workflow = JSON.parse(ev.target?.result as string);
        if (workflow.steps) {
          setRecordedSteps(workflow.steps);
          addLog(`Imported workflow: ${workflow.name} with ${workflow.steps.length} steps.`, "success");
          toast.success("Workflow imported");
        }
      } catch (err) {
        addLog("Failed to parse JSON workflow.", "error");
        toast.error("Invalid JSON format");
      }
    };
    reader.readAsText(file);
  };

  const handleExportJson = () => {
    const workflow = {
      name: `Huemn_Workflow_${agentId}_${new Date().getTime()}`,
      steps: recordedSteps,
      agentId
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name}.json`;
    a.click();
  };

  const getHardwareDetails = (key: string) => {
    switch(key) {
      case "basic": return "2 vCPU / 4GB RAM ($1.00/hr)";
      case "pro": return "4 vCPU / 8GB RAM ($2.00/hr)";
      case "ultra": return "8 vCPU / 16GB RAM ($4.00/hr)";
      default: return "";
    }
  };

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8 h-full flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Browser Studio <Badge variant="outline" className="ml-2 border-blue-500 text-blue-400">Hybrid Mode</Badge>
              </h1>
              <p className="text-white/60 text-lg">
                Design and test browser automations with zero-token deterministic mode or agentic AI.
                <span className="ml-2 text-xs text-blue-400/60">(Enterprise Rate: $0.25/GB RAM)</span>
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="file"
                id="import-workflow"
                className="hidden"
                accept=".json"
                onChange={handleImportJson}
              />
              <Button 
                variant="outline" 
                className="border-white/10 hover:bg-white/5"
                onClick={() => document.getElementById('import-workflow')?.click()}
              >
                📥 Import JSON
              </Button>
              <Button 
                variant="outline" 
                className="border-white/10 hover:bg-white/5"
                onClick={handleExportJson}
                disabled={recordedSteps.length === 0}
              >
                📤 Export JSON
              </Button>
              <Button 
                variant="outline" 
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                onClick={handleSave}
                disabled={recordedSteps.length === 0 || isExecuting}
              >
                💾 Save to Agent
              </Button>
              <Button 
                variant={isRecording ? "destructive" : "outline"} 
                className={isRecording ? "animate-pulse" : "border-white/10 hover:bg-white/5"}
                onClick={handleRecord}
                disabled={isExecuting}
              >
                {isRecording ? "Stop Recording" : "🔴 Record Steps"}
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleExecute} disabled={isExecuting || isRecording}>
                {isExecuting ? <><span className="mr-2"><LoadingSpinner size="sm" /></span> Executing...</> : "Execute Now"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* Configuration Panel */}
            <Card className="p-6 bg-[#1a1f3a]/80 backdrop-blur-xl border-white/10 flex flex-col gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Execution Mode</Label>
                  <Select value={mode} onValueChange={(val: any) => setMode(val)}>
                    <SelectTrigger className="bg-[#0f1419]/60 border-white/10 text-white">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f3a] border-white/10 text-white">
                      <SelectItem value="deterministic">Deterministic (Extensions)</SelectItem>
                      <SelectItem value="agent">Agentic (AI Vision)</SelectItem>
                      <SelectItem value="hybrid">Hybrid (Deterministic + AI)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-white/40 italic">
                    {mode === 'deterministic' && "Uses pre-recorded XPaths/Selectors. Cost-effective."}
                    {mode === 'agent' && "Uses Vision and LLM to navigate dynamically. High cost."}
                    {mode === 'hybrid' && "Replays steps and uses AI if elements move. Balanced."}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-white/80">Instructions / Prompt</Label>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g., Go to linkedin.com, find 'John Doe', and extract their current company."
                    className="w-full h-32 px-4 py-3 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Hardware Profile</Label>
                  <Select value={hardware} onValueChange={setHardware}>
                    <SelectTrigger className="bg-[#0f1419]/60 border-white/10 text-white">
                      <SelectValue placeholder="Select hardware" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f3a] border-white/10 text-white">
                      <SelectItem value="basic">Basic (4GB RAM)</SelectItem>
                      <SelectItem value="pro">Pro (8GB RAM)</SelectItem>
                      <SelectItem value="ultra">Ultra (16GB RAM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-white/40 italic">{getHardwareDetails(hardware)}</p>
                </div>

                {mode === "hybrid" && (
                  <div className="space-y-4 py-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-white/80">AI Healing Threshold</Label>
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                        {Math.round(aiThreshold * 100)}%
                      </Badge>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="0.95" 
                      step="0.05" 
                      value={aiThreshold} 
                      onChange={(e) => setAiThreshold(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-blue-500/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <p className="text-[10px] text-white/40 italic">
                      Lower threshold triggers AI healing more aggressively when elements move.
                    </p>
                  </div>
                )}

                {mode === "deterministic" && recordedSteps.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-white/80">Recorded Steps ({recordedSteps.length})</Label>
                    <ScrollArea className="h-32 rounded-lg border border-white/10 bg-[#0f1419]/40 p-2">
                      {recordedSteps.map((step, i) => (
                        <div key={i} className="text-[10px] text-white/60 font-mono mb-1 flex gap-2">
                          <span className="text-blue-400">{i+1}.</span>
                          <span>{step.type.toUpperCase()}: {step.selector}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>

              <div className="mt-auto">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <h4 className="text-sm font-semibold text-blue-300 mb-1">💡 Optimization Tip</h4>
                  <p className="text-xs text-blue-200/60">
                    Use deterministic mode for repetitive tasks with stable selectors to save tokens.
                  </p>
                </div>
              </div>
            </Card>

            {/* Visual Cast Area */}
            <Card className="lg:col-span-2 bg-[#0f1419]/60 border-white/10 overflow-hidden relative group">
              {castFrame ? (
                <div className="w-full h-full relative">
                  <img src={castFrame} alt="Visual Cast" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-red-600 rounded-full text-[10px] font-bold animate-pulse text-white uppercase tracking-wider">
                    Live Cast
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                  <div className="text-8xl mb-4">📺</div>
                  <p className="text-xl font-light">Visual output will appear here during execution</p>
                </div>
              )}
            </Card>
          </div>

          {/* Status Stream */}
          <Card className="h-48 bg-[#0f1419]/80 border-white/10 overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Execution Status Stream</span>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-500/80 font-mono">SOCKET_CONNECTED</span>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2 font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-white/20 italic">Awaiting execution...</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <span className="text-white/20 shrink-0">{log.timestamp.toLocaleTimeString([], { hour12: false })}</span>
                      <span className={`
                        ${log.type === 'status' ? 'text-blue-400' : ''}
                        ${log.type === 'error' ? 'text-red-400' : ''}
                        ${log.type === 'success' ? 'text-green-400' : ''}
                        ${log.type === 'info' ? 'text-white/60' : ''}
                      `}>
                        [{log.type.toUpperCase()}] {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
