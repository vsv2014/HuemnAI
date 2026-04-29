"use client";

import { useState } from "react";
import AdminNav from "@/components/AdminNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Clock, 
  BarChart3, 
  Calendar,
  AlertCircle
} from "lucide-react";

export default function WFMPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0f1419] text-white overflow-hidden">
        <AdminNav />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                  Work Force Management
                </h1>
                <p className="text-white/60 text-lg">
                  Optimize agent schedules, track real-time occupancy, and forecast demand.
                </p>
              </div>
              <Badge variant="outline" className="mb-2 border-blue-500/50 text-blue-400 bg-blue-500/5 px-4 py-1">
                Beta Access
              </Badge>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-[#1a1f3a]/60 border border-white/10 p-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">Real-time Overview</TabsTrigger>
                <TabsTrigger value="scheduling" className="data-[state=active]:bg-blue-600">Scheduling</TabsTrigger>
                <TabsTrigger value="forecasting" className="data-[state=active]:bg-blue-600">Forecasting</TabsTrigger>
                <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-600">Compliance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard title="Total Agents" value="42" icon={<Users className="w-4 h-4" />} trend="+2" />
                  <StatCard title="Active Now" value="38" icon={<Clock className="w-4 h-4" />} color="text-green-400" />
                  <StatCard title="Occupancy" value="84%" icon={<BarChart3 className="w-4 h-4" />} trend="-3%" />
                  <StatCard title="Shrinkage" value="12%" icon={<AlertCircle className="w-4 h-4" />} color="text-yellow-400" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 bg-[#1a1f3a]/80 border-white/10">
                    <CardHeader>
                      <CardTitle>Agent Status Real-time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <AgentRow name="Alex Johnson" status="Available" time="02:14:05" />
                        <AgentRow name="Sarah Miller" status="On Call" time="00:08:22" color="text-blue-400" />
                        <AgentRow name="Michael Chen" status="Lunch" time="00:25:00" color="text-yellow-400" />
                        <AgentRow name="Emily Davis" status="Available" time="01:45:12" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1f3a]/80 border-white/10">
                    <CardHeader>
                      <CardTitle>Service Level (SL)</CardTitle>
                      <CardDescription>Target: 80/20</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-6">
                      <div className="text-5xl font-bold text-green-400 mb-2">82.4%</div>
                      <p className="text-white/40 text-sm">Live Service Level</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="scheduling">
                <Card className="bg-[#1a1f3a]/80 border-white/10 h-64 flex items-center justify-center">
                  <div className="text-center text-white/40">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Shift bidding and scheduling tools coming soon.</p>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

function StatCard({ title, value, icon, trend, color = "text-white" }: any) {
  return (
    <Card className="bg-[#1a1f3a]/60 border-white/10">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{title}</p>
          <div className="text-blue-400/60">{icon}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
          {trend && (
            <span className={`text-[10px] ${trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentRow({ name, status, time, color = "text-green-400" }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0f1419]/40 border border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs">
          {name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className={`text-[10px] font-bold ${color}`}>{status.toUpperCase()}</p>
        </div>
      </div>
      <div className="text-xs font-mono text-white/40">{time}</div>
    </div>
  );
}
