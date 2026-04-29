"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "react-hot-toast";

export default function VoiceGatewayPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [activeTab, setActiveTab] = useState("settings");

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8 h-full flex flex-col">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Voice & Outreach
              </h1>
              <p className="text-white/60 text-lg">
                Manage IVR settings, Voice AI profiles, and Outbound Campaigns.
              </p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/5">
                Gateway Active
              </Badge>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="bg-[#1a1f3a]/60 border border-white/10 p-1 self-start mb-6">
              <TabsTrigger value="settings" className="data-[state=active]:bg-blue-600">Gateway Settings</TabsTrigger>
              <TabsTrigger value="campaigns" className="data-[state=active]:bg-blue-600">Outbound Campaigns</TabsTrigger>
              <TabsTrigger value="dnc" className="data-[state=active]:bg-blue-600">DNC Registry</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#1a1f3a]/80 border-white/10">
                  <CardHeader>
                    <CardTitle>Inbound IVR</CardTitle>
                    <CardDescription>Configure how the agent handles incoming calls.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-[#0f1419]/60 border border-white/5">
                      <p className="text-xs text-white/40 mb-1">Assigned Phone Number</p>
                      <p className="text-lg font-mono text-white">+1 (555) 012-3456</p>
                    </div>
                    <Button variant="outline" className="w-full border-white/10">Configure IVR Flow</Button>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1f3a]/80 border-white/10">
                  <CardHeader>
                    <CardTitle>Voice Profile</CardTitle>
                    <CardDescription>Select the AI voice for this agent.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-[#0f1419]/60 border border-white/5">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl">👤</div>
                      <div>
                        <p className="font-medium">"Serena" (Conversational)</p>
                        <p className="text-xs text-white/40">Huemn Turbo v2 • English (US)</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full border-white/10">Change Voice</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="campaigns" className="flex-1">
              <Card className="bg-[#1a1f3a]/80 border-white/10 h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Outreach Campaigns</CardTitle>
                    <CardDescription>Schedule proactive Voice/SMS outreach.</CardDescription>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">+ New Campaign</Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-20 text-white/20">
                    <div className="text-6xl mb-4">📣</div>
                    <p>No active campaigns. Create one to start reaching out to leads.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dnc" className="flex-1">
              <Card className="bg-[#1a1f3a]/80 border-white/10 h-full">
                <CardHeader>
                  <CardTitle>Do Not Call (DNC) Registry</CardTitle>
                  <CardDescription>Numbers in this list will be automatically skipped in all campaigns.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-3">
                    <Input placeholder="Enter phone number (+1...)" className="bg-[#0f1419]/60 border-white/10" />
                    <Button className="bg-red-600 hover:bg-red-700">Add to DNC</Button>
                  </div>
                  
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white/5 text-white/40">
                        <tr>
                          <th className="px-4 py-3 font-medium">Phone Number</th>
                          <th className="px-4 py-3 font-medium">Date Added</th>
                          <th className="px-4 py-3 font-medium">Reason</th>
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        <tr>
                          <td className="px-4 py-3">+1 (555) 000-1111</td>
                          <td className="px-4 py-3 text-white/60">2024-04-29</td>
                          <td className="px-4 py-3 text-white/60">User Opt-out</td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 px-2">Remove</Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
