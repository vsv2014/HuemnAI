"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

const digitalChannels = [
  { id: "cisco-jabber", name: "Cisco Jabber", logo: "🔵", category: "Enterprise" },
  { id: "cisco-webex", name: "Cisco Webex Teams", logo: "🟠", category: "Enterprise" },
  { id: "amazon-connect", name: "Amazon Connect Chat", logo: "🧠", category: "Enterprise" },
  { id: "sinch", name: "Sinch", logo: "🟡", category: "Enterprise" },
  { id: "genesys", name: "Genesys Cloud CX Messaging", logo: "🔴", category: "Enterprise" },
  { id: "google-assistant", name: "Google Assistant", logo: "🔵", category: "Enterprise" },
  { id: "hangouts", name: "Hangouts Chat", logo: "🟢", category: "Enterprise" },
  { id: "mattermost", name: "Mattermost", logo: "⚫", category: "Enterprise" },
  { id: "teams", name: "Microsoft Teams", logo: "🟣", category: "Enterprise" },
  { id: "naver", name: "Naver Works", logo: "🟢", category: "Enterprise" },
  { id: "nice", name: "NICE inContact", logo: "🔵", category: "Enterprise" },
  { id: "rcs", name: "RCS", logo: "🔵", category: "Enterprise" },
  { id: "ringcentral", name: "RingCentral", logo: "🟠", category: "Enterprise" },
  { id: "skype", name: "Skype", logo: "🔵", category: "Enterprise" },
];

export default function DigitalChannelsPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [filter, setFilter] = useState("Configured All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChannels = useMemo(() => {
    return digitalChannels.filter((channel) =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Digital Channels
            </h1>
            <p className="text-white/60 text-lg">
              Enable the virtual assistant to be on digital channels including live chat platforms, 3rd party messengers, and more
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
            >
              <option>Configured All</option>
              <option>Configured</option>
              <option>Available</option>
            </select>
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white placeholder-white/40"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-4xl">{channel.logo}</div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">{channel.name}</h3>
                    <p className="text-sm text-white/60">{channel.category}</p>
                  </div>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Configure
                </button>
              </div>
            ))}
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
