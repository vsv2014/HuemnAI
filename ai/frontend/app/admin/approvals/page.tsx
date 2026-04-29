"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { toast } from "react-hot-toast";

interface ApprovalRequest {
  id: number;
  conversation_id: number;
  status: string;
  title: string;
  description: string;
  priority: string;
  created_at: string;
  customer_info: any;
}

export default function ApprovalsInboxPage() {
  const { token } = useAuthStore();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/tickets?status=awaiting_approval`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (err) {
      toast.error("Failed to fetch approval requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchApprovals();
  }, [token]);

  const handleAction = async (id: number, action: "approved" | "rejected") => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/tickets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: action })
      });

      if (response.ok) {
        toast.success(`Request ${action} successfully`);
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(`Failed to ${action} request`);
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0f1419] text-white overflow-hidden">
        <AdminNav />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
                Approval Inbox
              </h1>
              <p className="text-white/60 text-lg">
                Manage Human-in-the-loop approval requests from HIL nodes.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : requests.length === 0 ? (
              <Card className="bg-[#1a1f3a]/60 border-white/10 p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-medium text-white/80">No pending approvals</h3>
                <p className="text-white/40 mt-2">All requests have been processed.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {requests.map((request) => (
                  <Card key={request.id} className="bg-[#1a1f3a]/80 border-white/10 hover:border-blue-500/30 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <Badge className={request.priority === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}>
                          {request.priority.toUpperCase()}
                        </Badge>
                        <CardTitle className="text-lg">{request.title}</CardTitle>
                      </div>
                      <span className="text-xs text-white/40">
                        {new Date(request.created_at).toLocaleString()}
                      </span>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white/70 mb-4">{request.description}</p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-white/40 font-mono">
                          Conversation ID: {request.conversation_id}
                        </div>
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleAction(request.id, "rejected")}
                          >
                            Reject
                          </Button>
                          <Button 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAction(request.id, "approved")}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
