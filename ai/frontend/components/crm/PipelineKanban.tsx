/**
 * PipelineKanban Component
 * 
 * Visual pipeline board for managing opportunities through sales stages.
 * Features: stage columns, deal cards, forecasting, filtering
 * AI-powered deal recommendations and risk alerts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from "@/store/authStore";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Deal {
  id: string;
  name: string;
  company: string;
  amount: number;
  probability: number;
  stage: string;
  close_date: string;
  owner_id: string;
  risk_level?: 'low' | 'medium' | 'high';
  ai_insight?: string;
}

interface Stage {
  id: string;
  name: string;
  order: number;
}

interface PipelineKanbanProps {
  onDealClick: (dealId: string) => void;
  onStageChange: (dealId: string, newStage: string) => Promise<void>;
  readOnly?: boolean;
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  onMove?: (newStage: string) => void;
  readOnly?: boolean;
}

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
  onDealClick: (dealId: string) => void;
  onMoveDeal?: (dealId: string, newStage: string) => void;
  readOnly?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onClick, onMove, readOnly }) => {
  const riskColor = {
    low: 'bg-[#0f1b34]/70 border-white/10',
    medium: 'bg-[#2b2410]/70 border-white/10',
    high: 'bg-[#2b1010]/70 border-white/10',
  };
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 hover:shadow-md transition overflow-hidden h-[150px] flex flex-col justify-between ${
        riskColor[deal.risk_level || 'low']
      }`}
    >
      <h4 className="font-semibold text-white truncate text-sm">{deal.name}</h4>
      <p className="text-xs text-white/70 truncate">{deal.company}</p>
      <div className="mt-2 flex justify-between items-baseline">
        <span className="text-sm font-bold text-sky-400">${(deal.amount / 1000).toFixed(0)}K</span>
        <span className="text-xs text-white/60">{deal.probability}% prob</span>
      </div>
      <p className="text-xs text-white/60 mt-1">
        Close: {new Date(deal.close_date).toLocaleDateString()}
      </p>
      {deal.ai_insight && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-xs text-white/70 italic">💡 {deal.ai_insight}</p>
        </div>
      )}
      {deal.risk_level && deal.risk_level !== 'low' && (
        <div className="mt-2">
          <span className="inline-block px-2 py-1 bg-red-600/20 text-red-300 text-xs rounded font-semibold border border-red-600/30">
            ⚠️ {deal.risk_level.toUpperCase()} RISK
          </span>
        </div>
      )}
      {!readOnly && onMove && (
        <div className="mt-3 flex gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) onMove(val);
            }}
            className="w-full text-xs bg-white/5 border border-white/10 text-white rounded px-2 py-1"
          >
            <option value="" disabled>Move to stage...</option>
            <option value="prospecting">Prospecting</option>
            <option value="qualification">Qualification</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
        </div>
      )}
    </div>
  );
};

const StageColumn: React.FC<StageColumnProps> = ({ stage, deals, onDealClick, onMoveDeal, readOnly }) => {
  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const avgProbability = deals.length > 0
    ? Math.round(deals.reduce((sum, deal) => sum + deal.probability, 0) / deals.length)
    : 0;
  const stageBg: Record<string, string> = {
    prospecting: 'bg-gradient-to-br from-[#121a3a]/60 to-[#0e132b]/60',
    qualification: 'bg-gradient-to-br from-[#1a123a]/60 to-[#0e0b2b]/60',
    proposal: 'bg-gradient-to-br from-[#123a1a]/60 to-[#0b2b16]/60',
    negotiation: 'bg-gradient-to-br from-[#3a2a12]/60 to-[#2b1e0b]/60',
    closed_won: 'bg-gradient-to-br from-emerald-900/40 to-emerald-800/20',
    closed_lost: 'bg-gradient-to-br from-red-900/40 to-red-800/20',
  };
  return (
    <div className={`${stageBg[stage.id] || 'bg-white/5'} rounded-lg p-4 flex flex-col min-w-[280px] border border-white/10`}>
      <div className="mb-4 pb-4 border-b border-white/10">
        <h3 className="font-bold text-white">{stage.name}</h3>
        <p className="text-sm text-white/70 mt-1">{deals.length} deals</p>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-white/80">
            <strong>Total:</strong> ${(totalAmount / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-white/80">
            <strong>Avg Prob:</strong> {avgProbability}%
          </p>
        </div>
      </div>
      <div className={`space-y-3 flex-1 ${stage.id === 'prospecting' ? 'h-[960px]' : 'h-auto'} overflow-y-scroll overscroll-contain pr-1`}>
        {deals.length === 0 ? (
          <div className="text-center text-white/50 py-8">
            <p className="text-sm">No deals in this stage</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal.id)}
              readOnly={readOnly}
              onMove={(newStage) => onMoveDeal && onMoveDeal(deal.id, newStage)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  onDealClick,
  onStageChange,
  readOnly = false,
}) => {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const token = useAuthStore((s) => s.token);
  const [stages, setStages] = useState<Stage[]>([
    { id: 'prospecting', name: '📌 Prospecting', order: 1 },
    { id: 'qualification', name: '🎥 Qualification', order: 2 },
    { id: 'proposal', name: '📄 Proposal', order: 3 },
    { id: 'negotiation', name: '🤝 Negotiation', order: 4 },
    { id: 'closed_won', name: '✅ Closed Won', order: 5 },
    { id: 'closed_lost', name: '❌ Closed Lost', order: 6 },
  ]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDeal, setNewDeal] = useState<{ title: string; company: string; stage: string; value: number; owner_name: string; due_date: string }>({
    title: "",
    company: "",
    stage: "prospecting",
    value: 0,
    owner_name: "",
    due_date: ""
  });
  const [filterOwner, setFilterOwner] = useState<string | null>(null);
  const [showForecast, setShowForecast] = useState(true);
  const [insights, setInsights] = useState<any>(null);
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const loadDeals = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/crm/deals`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.deals || []).map((d: any) => ({
        id: String(d.id),
        name: d.title || "",
        company: d.company || "",
        amount: d.value || 0,
        probability: d.probability || 0,
        stage: d.stage || "lead",
        close_date: d.dueDate || "",
        owner_id: d.owner || ""
      })) as Deal[];
      setDeals(items);
    } catch {}
  };
  useEffect(() => {
    loadDeals();
    const loadInsights = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/crm/insights`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        setInsights(data);
      } catch {}
    };
    loadInsights();
  }, [token]);
  useEffect(() => {
    try {
      const wsUrl = `${API_BASE.replace("http", "ws")}/ws/crm?client_id=crm`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.event === "deals_updated") {
            loadDeals();
          }
        } catch {}
      };
      return () => { try { ws.close(); } catch {} };
    } catch {}
  }, []);
  const calculateForecast = () => {
    const forecast = deals.reduce((sum, deal) => {
      if (!filterOwner || deal.owner_id === filterOwner) {
        return sum + (deal.amount * deal.probability) / 100;
      }
      return sum;
    }, 0);
    return forecast;
  };
  const moveDeal = async (dealId: string, newStageId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage !== newStageId) {
      try {
        await onStageChange(dealId, newStageId);
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stage: newStageId } : d))
        );
      } catch (error) {
        console.error('Failed to update stage:', error);
      }
    }
  };
  const filteredDeals = filterOwner
    ? deals.filter((d) => d.owner_id === filterOwner)
    : deals;
  const dealsByStage = (stageId: string) => {
    return filteredDeals.filter((d) => d.stage === stageId);
  };
  const forecast = insights?.metrics?.weighted_forecast ?? calculateForecast();
  const totalPipeline = insights?.metrics?.total_pipeline ?? filteredDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDeals.forEach((d) => {
      counts[d.stage] = (counts[d.stage] || 0) + 1;
    });
    // fallback to insights if available and no local data
    if (Object.keys(counts).length === 0) {
      const insCounts = insights?.metrics?.stage_counts || {};
      return Object.entries(insCounts).map(([stage, count]) => ({ stage, count: Number(count) || 0 }));
    }
    return Object.entries(counts).map(([stage, count]) => ({ stage, count }));
  }, [filteredDeals, insights]);
  return (
    <div className="p-6 bg-gradient-to-br from-[#0b1026] via-[#0e1430] to-[#0b1026] rounded-2xl border border-white/10 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Sales Pipeline</h1>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <p className="text-sm text-white/70">Total Pipeline</p>
            <p className="text-2xl font-bold text-blue-400">${(totalPipeline / 1000000).toFixed(1)}M</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <p className="text-sm text-white/70">Weighted Forecast</p>
            <p className="text-2xl font-bold text-emerald-400">${(forecast / 1000000).toFixed(1)}M</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <p className="text-sm text-white/70">Deal Count</p>
            <p className="text-2xl font-bold text-fuchsia-400">{filteredDeals.length}</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <p className="text-sm text-white/70">At Risk</p>
            <p className="text-2xl font-bold text-orange-400">
              {filteredDeals.filter((d) => d.risk_level === 'high' || d.risk_level === 'medium').length}
            </p>
          </div>
        </div>
        <div className="mt-6 flex gap-4 items-center">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showForecast}
              onChange={(e) => setShowForecast(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-white/80">Show AI Forecast</span>
          </label>
          <select
            value={filterOwner || ''}
            onChange={(e) => setFilterOwner(e.target.value || null)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
          >
            <option value="">All Team Members</option>
            <option value="1">Sarah (VP Sales)</option>
            <option value="2">John (Rep)</option>
            <option value="3">Maria (Rep)</option>
          </select>
          <button onClick={() => setShowNewDeal(true)} className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
            ➕ New Deal
          </button>
        </div>
      </div>
      <div className="grid grid-flow-col auto-cols-[280px] gap-4 overflow-x-scroll pb-1">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage(stage.id)}
            onDealClick={onDealClick}
            onMoveDeal={moveDeal}
            readOnly={readOnly}
          />
        ))}
      </div>
      {showForecast && (
        <div className="mt-8 bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-bold mb-4">🤖 AI Insights & Recommendations</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-red-300 mb-2">⚠️ At-Risk Deals (Action Needed)</h3>
              <ul className="space-y-2">
                {(insights?.at_risk || []).map((d: any) => (
                  <li key={d.id} className="text-sm text-white/80 flex gap-2">
                    <span className="flex-1">{d.title}</span>
                    <span className="text-orange-400 font-semibold">${((d.value || 0) / 1000).toFixed(0)}K</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-300 mb-2">✅ High-Probability Deals (Ready to Close)</h3>
              <ul className="space-y-2">
                {filteredDeals.filter((d)=>d.probability>=75).map((deal)=>(
                  <li key={deal.id} className="text-sm text-white/80 flex gap-2">
                    <span className="flex-1">{deal.name}</span>
                    <span className="text-emerald-400 font-semibold">{deal.probability}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-white/70 mb-2">Stage Distribution</p>
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer>
                    <BarChart data={stageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f274f" />
                      <XAxis dataKey="stage" stroke="#b4c1ff" />
                      <YAxis stroke="#b4c1ff" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#5b7cff" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-white/70 mb-2">Forecast Progress</p>
                <div className="space-y-1">
                  <div className="text-sm">Total: ${((totalPipeline)/1000000).toFixed(1)}M</div>
                  <div className="text-sm">Weighted: ${((forecast)/1000000).toFixed(1)}M</div>
                  <div className="bg-white/10 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((forecast/(totalPipeline||1))*100))}%` }}></div>
                  </div>
                  <div className="text-xs text-white/60">Confidence preview</div>
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-white/70 mb-2">Next Best Actions</p>
              <ul className="space-y-2">
                {(insights?.at_risk || []).slice(0,3).map((d:any)=>(
                  <li key={d.id} className="text-sm text-white/80 flex items-center justify-between">
                    <span>Follow up on {d.title}</span>
                    <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Draft Email</button>
                  </li>
                ))}
                {filteredDeals.filter(d=>d.probability>=80).slice(0,2).map(d=>(
                  <li key={d.id} className="text-sm text-white/80 flex items-center justify-between">
                    <span>Schedule close call for {d.name}</span>
                    <button className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">Create Task</button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-white/70 mb-1">Forecast Confidence</p>
              <div className="bg-white/10 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
              <p className="text-xs text-white/60 mt-1">78% (Based on historical data)</p>
            </div>
          </div>
        </div>
      )}
      {showNewDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-[#0f142e] border border-white/10 rounded-xl p-6 w-full max-w-md text-white">
            <h3 className="text-lg font-bold mb-4">New Deal</h3>
            <div className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Title" value={newDeal.title} onChange={e=>setNewDeal({...newDeal,title:e.target.value})}/>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Company" value={newDeal.company} onChange={e=>setNewDeal({...newDeal,company:e.target.value})}/>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Owner" value={newDeal.owner_name} onChange={e=>setNewDeal({...newDeal,owner_name:e.target.value})}/>
              <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Due Date (YYYY-MM-DD)" value={newDeal.due_date} onChange={e=>setNewDeal({...newDeal,due_date:e.target.value})}/>
              <div className="flex gap-2">
                <select className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white" value={newDeal.stage} onChange={e=>setNewDeal({...newDeal,stage:e.target.value})}>
                  <option value="prospecting">Prospecting</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
                <input className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white placeholder-white/50" placeholder="Value" type="number" value={newDeal.value} onChange={e=>setNewDeal({...newDeal,value:Number(e.target.value)})}/>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="px-4 py-2 border border-white/10 rounded" onClick={()=>setShowNewDeal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" onClick={async ()=>{
                try{
                  const res = await fetch(`${API_BASE}/api/crm/deals`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(newDeal)
                  });
                  if (res.ok) {
                    setShowNewDeal(false);
                    setNewDeal({ title:"", company:"", stage:"lead", value:0, owner_name:"", due_date:"" });
                    await loadDeals();
                  }
                } catch {}
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineKanban;
