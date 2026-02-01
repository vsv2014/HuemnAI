"use client";

import { useState } from "react";
import { Message } from "@/store/chatStore";
import { useChatStore } from "@/store/chatStore";

interface RichMessageProps {
  message: Message;
}

export default function RichMessage({ message }: RichMessageProps) {
  const { role, text, data } = message;
  const isUser = role === "user";
  const { sendMessage } = useChatStore();
  const [booking, setBooking] = useState<{ [key: number]: boolean }>({});

  // Parse structured data if available
  const renderContent = () => {
    if (!data) {
      // Simple text message - format with line breaks
      return (
        <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
      );
    }

    // Handle different response types
    if (data.type === "TICKET_CREATED" || data.type === "TICKET_UPDATED") {
      return (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
          
          {/* Similar Ticket Reference */}
          {data.similar_ticket_id && (
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 backdrop-blur-sm shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-green-500/20">
                  <span className="text-lg block">🔗</span>
                </div>
                <span className="font-semibold text-green-300 tracking-wide text-sm">Based on Previous Resolution</span>
              </div>
              <p className="text-sm text-white/80 pl-11">
                This ticket was resolved using insights from Ticket #{data.similar_ticket_id}
              </p>
            </div>
          )}
          
          {/* Ticket Info Card */}
          <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 backdrop-blur-sm shadow-lg">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-blue-500/10">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <span className="text-xl block">
                  {data.type === "TICKET_CREATED" ? "🎫" : "📝"}
                </span>
              </div>
              <span className="font-bold text-blue-100 tracking-wide">
                {data.type === "TICKET_CREATED" ? "Ticket Created" : "Ticket Updated"}
              </span>
            </div>
            <div className="text-sm space-y-2 pl-1">
              <div className="flex justify-between items-center">
                <span className="text-white/60">Ticket ID</span>
                <span className="font-mono text-blue-300">#{data.ticket_id}</span>
              </div>
              {data.assigned_to && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Assigned to</span>
                  <span className="font-medium text-white">{data.assigned_to}</span>
                </div>
              )}
              {data.priority && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Priority</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    data.priority === "urgent" ? "bg-red-500/20 border-red-500/30 text-red-300" :
                    data.priority === "high" ? "bg-orange-500/20 border-orange-500/30 text-orange-300" :
                    "bg-yellow-500/20 border-yellow-500/30 text-yellow-300"
                  }`}>
                    {data.priority.toUpperCase()}
                  </span>
                </div>
              )}
              {data.severity && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Severity</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    data.severity === "critical" ? "bg-red-500/20 border-red-500/30 text-red-300" :
                    data.severity === "high" ? "bg-orange-500/20 border-orange-500/30 text-orange-300" :
                    data.severity === "medium" ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300" :
                    "bg-blue-500/20 border-blue-500/30 text-blue-300"
                  }`}>
                    {data.severity.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Troubleshooting Steps */}
          {data.troubleshooting?.steps?.length > 0 && (
            <div className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="font-semibold mb-3 text-green-300 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs">🔧</span>
                Troubleshooting Steps
              </p>
              <ol className="space-y-3 relative border-l border-white/10 ml-3 pl-6">
                {data.troubleshooting.steps.map((step: string, idx: number) => (
                  <li key={idx} className="text-sm text-white/90 relative">
                    <span className="absolute -left-[31px] top-0 w-2.5 h-2.5 rounded-full bg-green-500/50 border border-green-400"></span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Potential Solution */}
          {data.troubleshooting?.potential_solution && (
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/5 border border-purple-500/20 shadow-lg">
              <p className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
                <span className="text-lg">💡</span>
                Potential Solution
              </p>
              <p className="text-sm text-white/90 leading-relaxed pl-7">{data.troubleshooting.potential_solution}</p>
            </div>
          )}
        </div>
      );
    }

    // Handle generic options/buttons (from Entity Node or Question Node)
    if (data.options || data.ui_options) {
      const options = data.options || data.ui_options;
      return (
        <div className="space-y-3">
           <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
           <div className="flex flex-wrap gap-2.5 mt-3">
             {options.map((option: any, idx: number) => (
               <button
                 key={idx}
                 onClick={() => sendMessage(option.value || option.label)}
                 className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-blue-200 border border-white/10 hover:border-blue-400/50 rounded-xl text-sm transition-all duration-300 hover:-translate-y-0.5 shadow-sm hover:shadow-blue-500/20"
               >
                 {option.label}
               </button>
             ))}
           </div>
        </div>
      );
    }

    if (data.type === "SHORTLIST" || (data.action === "shortlist" && data.candidates)) {
      return (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
          
          {/* Candidates List */}
          {data.candidates && data.candidates.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="font-bold text-blue-300 text-sm tracking-wide uppercase opacity-80 mb-2">
                👥 Found {data.count || data.candidates.length} Candidates
              </p>
              {data.candidates.map((candidate: any, idx: number) => (
                <div key={idx} className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-sm hover:shadow-lg">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-bold text-lg text-white group-hover:text-blue-200 transition-colors">{candidate.name || `Candidate ${idx + 1}`}</h4>
                    {candidate.source && (
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 px-2 py-1 rounded text-white/60">
                        {candidate.source}
                      </span>
                    )}
                  </div>
                  <div className="text-sm space-y-2 text-white/80">
                    {candidate.current_title && (
                      <p className="flex items-center gap-2">
                        <span className="text-white/40 w-4">💼</span>
                        {candidate.current_title}
                      </p>
                    )}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <p className="flex items-start gap-2">
                        <span className="text-white/40 w-4 mt-0.5">⭐</span>
                        <span className="text-blue-200/90 leading-relaxed">
                          {candidate.skills.join(", ")}
                        </span>
                      </p>
                    )}
                    {candidate.experience_years !== undefined && (
                      <p className="flex items-center gap-2">
                        <span className="text-white/40 w-4">⏱️</span>
                        {candidate.experience_years} years exp
                      </p>
                    )}
                    {candidate.linkedin_url && (
                      <p className="pt-2 mt-2 border-t border-white/5">
                        <a
                          href={candidate.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          View Profile <span className="text-lg">→</span>
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (data.action === "post_job" && data.success) {
      return (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
          
          <div className="mt-3 p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-green-500/10">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
              <span className="font-bold text-green-100 text-lg">Job Posted Successfully</span>
            </div>
            <div className="text-sm space-y-3">
              <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-1">Job Title</p>
                <p className="font-medium text-white text-lg">{data.job?.title || "N/A"}</p>
              </div>
              
              {data.posted_to && data.posted_to.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-2">Posted Platforms</p>
                  <div className="flex flex-wrap gap-2">
                    {data.posted_to.filter(Boolean).map((platform: string, i: number) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-medium">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.job?.id && (
                <p className="text-xs text-white/40 text-right pt-2">Ref ID: {data.job.id}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Ticket Booking Results
    if (data.type === "SEARCH_RESULTS" || data.type === "COLLECT_DETAILS" || data.type === "INFO") {
      return (
        <div className="space-y-4">
          {/* Ticket Type Image */}
          {data.ticket_type_image && (
            <div className="mb-4 overflow-hidden rounded-xl border border-white/10 shadow-2xl group">
              <div className="relative aspect-video">
                 <img
                  src={data.ticket_type_image}
                  alt={data.ticket_type || "Ticket"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-3 left-4">
                   <span className="text-white font-bold text-lg shadow-black/50 drop-shadow-md">{data.ticket_type}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
          
          {/* Search Results */}
          {data.type === "SEARCH_RESULTS" && data.results && (
            <div className="mt-5 space-y-4">
              <p className="font-bold text-blue-300 mb-3 flex items-center gap-2 text-sm tracking-wide uppercase">
                <span className="text-lg">🎫</span>
                {data.total_options || data.results.length} Options Found
              </p>
              {data.results.slice(0, 5).map((result: any, idx: number) => {
                const isBooking = booking[idx] || false;
                const isBest = idx === 0 && data.best_option?.platform === result.platform;
                
                const handleBookNow = async () => {
                  setBooking({ ...booking, [idx]: true });
                  try {
                    // Send booking request
                    const bookingMessage = `I want to book ${data.ticket_type} ticket from ${result.platform} for ${result.currency_symbol || "$"}${result.price} ${result.currency || "USD"}`;
                    await sendMessage(bookingMessage);
                  } catch (error) {
                    console.error("Booking error:", error);
                    setBooking({ ...booking, [idx]: false });
                  }
                };

                return (
                  <div
                    key={idx}
                    className={`relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      isBest
                        ? "bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/30 shadow-green-900/10"
                        : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {isBest && (
                      <div className="absolute -top-3 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-green-400/50 flex items-center gap-1">
                        <span>🏆</span> BEST PRICE
                      </div>
                    )}
                    
                    <div className="flex items-start gap-4">
                      {/* Platform Image */}
                      {result.platform_image && (
                        <div className="w-16 h-16 rounded-xl border border-white/10 bg-white/5 p-2 flex items-center justify-center backdrop-blur-sm shrink-0">
                          <img
                            src={result.platform_image}
                            alt={result.platform}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-lg text-white truncate">{result.platform}</h4>
                          <span className={`text-xl font-bold ${isBest ? "text-green-400" : "text-white"}`}>
                            {result.currency_symbol || "$"}{result.price}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {result.rating && (
                            <span className="text-xs bg-yellow-500/10 text-yellow-300 px-2 py-1 rounded border border-yellow-500/20 flex items-center gap-1">
                              ⭐ {result.rating}
                            </span>
                          )}
                          {result.estimated_time && (
                            <span className="text-xs bg-white/5 text-white/70 px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                              ⏱️ {result.estimated_time}
                            </span>
                          )}
                        </div>

                        {result.features && result.features.length > 0 && (
                          <div className="text-xs text-white/60 mb-4 flex flex-wrap gap-x-3 gap-y-1">
                            {result.features.map((f: string, i: number) => (
                              <span key={i} className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <button
                          onClick={handleBookNow}
                          disabled={isBooking}
                          className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-300 shadow-lg ${
                            isBooking
                              ? "bg-white/5 text-white/40 cursor-not-allowed border border-white/5"
                              : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                          }`}
                        >
                          {isBooking ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            "📅 Book This Ticket"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Price Comparison Summary */}
              {data.price_comparison && (
                <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 backdrop-blur-sm">
                  <p className="font-semibold text-blue-300 mb-3 text-xs uppercase tracking-wider">💰 Market Analysis</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-white/40 block">Lowest</span>
                      <span className="text-green-400 font-bold">
                        {data.currency_symbol || "$"}{data.price_comparison.lowest}
                      </span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-white/40 block">Average</span>
                      <span className="text-white font-bold">
                        {data.currency_symbol || "$"}{data.price_comparison.average?.toFixed(0)}
                      </span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-white/40 block">Highest</span>
                      <span className="text-white/60 font-bold">
                        {data.currency_symbol || "$"}{data.price_comparison.highest}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Required Fields for Booking */}
          {data.type === "COLLECT_DETAILS" && data.required_fields && (
            <div className="mt-4 p-5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 shadow-lg">
              <p className="font-bold text-yellow-200 mb-4 flex items-center gap-2">
                <span className="text-xl">📋</span>
                Required Information
              </p>
              <div className="space-y-2">
                {data.required_fields.map((field: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 text-sm bg-black/20 p-3 rounded-lg border border-white/5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-bold">{idx + 1}</span>
                    <span className="text-white/90 font-medium">{field.label}</span>
                    <span className="text-red-400 text-xs font-bold ml-auto px-2 py-0.5 rounded bg-red-500/10">REQUIRED</span>
                  </div>
                ))}
              </div>
              {data.optional_fields && data.optional_fields.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="font-semibold text-yellow-200/60 mb-3 text-xs uppercase tracking-wider">Optional Fields</p>
                  <div className="space-y-2">
                    {data.optional_fields.map((field: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 text-sm px-3 py-2 text-white/60">
                        <span className="w-5 text-center text-xs opacity-50">•</span>
                        <span>{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Capabilities Info */}
          {data.type === "INFO" && data.capabilities && (
            <div className="mt-4 p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/20">
              <p className="font-bold text-purple-200 mb-3 flex items-center gap-2">
                <span className="text-lg">✨</span>
                Capabilities
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.capabilities.map((cap: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm bg-white/5 p-2 rounded-lg border border-white/5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span className="text-white/80">{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Question Flow - Interactive ticket creation
    if (data.type === "QUESTION_FLOW") {
      return (
        <div className="space-y-4">
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
          
          {/* Similar Tickets Found */}
          {data.similar_tickets_found > 0 && (
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔍</span>
                <span className="font-semibold text-green-300">
                  Found {data.similar_tickets_found} Similar {data.similar_tickets_found === 1 ? "Ticket" : "Tickets"}
                </span>
              </div>
              <p className="text-sm text-white/80 pl-7">
                I've found similar issues we've resolved before. This helps me provide you with more accurate assistance.
              </p>
            </div>
          )}
          
          {/* Question Flow Card */}
          <div className="mt-3 p-5 rounded-xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">?</span>
              </div>
              <span className="font-bold text-white text-lg tracking-wide">Information Required</span>
            </div>
            
            {data.next_question && (
              <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
                <p className="text-xs font-bold text-blue-300 mb-2 uppercase tracking-wider">Current Question</p>
                <p className="text-white text-lg font-light leading-relaxed">{data.next_question}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              {data.issue_type && (
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <strong className="text-white/40 text-xs uppercase block mb-1">Issue Type</strong>
                  <span className="text-white capitalize font-medium">{data.issue_type}</span>
                </div>
              )}
              {data.severity && (
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <strong className="text-white/40 text-xs uppercase block mb-1">Severity</strong>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                    data.severity === "critical" ? "bg-red-500/20 text-red-300" :
                    data.severity === "high" ? "bg-orange-500/20 text-orange-300" :
                    data.severity === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                    "bg-blue-500/20 text-blue-300"
                  }`}>
                    {data.severity.toUpperCase()}
                  </span>
                </div>
              )}
              {data.priority && (
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <strong className="text-white/40 text-xs uppercase block mb-1">Priority</strong>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                    data.priority === "urgent" ? "bg-red-500/20 text-red-300" :
                    data.priority === "high" ? "bg-orange-500/20 text-orange-300" :
                    data.priority === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                    "bg-blue-500/20 text-blue-300"
                  }`}>
                    {data.priority.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default: render text with formatting
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6 group animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-6 py-4 shadow-lg transition-all duration-300 ${
            isUser
              ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-none border border-white/10 shadow-purple-900/20"
              : "bg-white/5 text-white border border-white/10 rounded-bl-none backdrop-blur-md shadow-black/20 hover:bg-white/10"
          }`}
        >
          {renderContent()}
        </div>
        <div className={`mt-2 text-xs font-medium text-white/30 px-2 flex items-center gap-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <span>{isUser ? "You" : "Assistant"}</span>
          <span className="w-1 h-1 rounded-full bg-white/20"></span>
          <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
      </div>
    </div>
  );
}
