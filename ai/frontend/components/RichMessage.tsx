"use client";

import { useState } from "react";
import { Message } from "@/store/chatStore";
import { bookTicket, handleBookingQuery } from "@/services/api";
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
        <div className="whitespace-pre-wrap">{text}</div>
      );
    }

    // Handle different response types
    if (data.type === "TICKET_CREATED" || data.type === "TICKET_UPDATED") {
      return (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap">{text}</div>
          
          {/* Similar Ticket Reference */}
          {data.similar_ticket_id && (
            <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔗</span>
                <span className="font-semibold text-green-300">Based on Previous Resolution</span>
              </div>
              <p className="text-sm text-white/80">
                This ticket was resolved using insights from Ticket #{data.similar_ticket_id}
              </p>
            </div>
          )}
          
          {/* Ticket Info Card */}
          <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {data.type === "TICKET_CREATED" ? "🎫" : "📝"}
              </span>
              <span className="font-semibold">
                {data.type === "TICKET_CREATED" ? "Ticket Created" : "Ticket Updated"}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Ticket ID:</strong> #{data.ticket_id}</p>
              {data.assigned_to && (
                <p><strong>Assigned to:</strong> {data.assigned_to}</p>
              )}
              {data.priority && (
                <p>
                  <strong>Priority:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    data.priority === "urgent" ? "bg-red-500/30 text-red-300" :
                    data.priority === "high" ? "bg-orange-500/30 text-orange-300" :
                    "bg-yellow-500/30 text-yellow-300"
                  }`}>
                    {data.priority.toUpperCase()}
                  </span>
                </p>
              )}
              {data.severity && (
                <p>
                  <strong>Severity:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    data.severity === "critical" ? "bg-red-500/30 text-red-300" :
                    data.severity === "high" ? "bg-orange-500/30 text-orange-300" :
                    data.severity === "medium" ? "bg-yellow-500/30 text-yellow-300" :
                    "bg-blue-500/30 text-blue-300"
                  }`}>
                    {data.severity.toUpperCase()}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Troubleshooting Steps */}
          {data.troubleshooting?.steps?.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="font-semibold mb-2 text-green-300">🔧 Troubleshooting Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {data.troubleshooting.steps.map((step: string, idx: number) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Potential Solution */}
          {data.troubleshooting?.potential_solution && (
            <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="font-semibold mb-1 text-purple-300">💡 Potential Solution:</p>
              <p className="text-sm">{data.troubleshooting.potential_solution}</p>
            </div>
          )}
        </div>
      );
    }

    if (data.type === "SHORTLIST" || (data.action === "shortlist" && data.candidates)) {
      return (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap">{text}</div>
          
          {/* Candidates List */}
          {data.candidates && data.candidates.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="font-semibold text-blue-300">
                👥 Found {data.count || data.candidates.length} Candidates:
              </p>
              {data.candidates.map((candidate: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{candidate.name || `Candidate ${idx + 1}`}</h4>
                    {candidate.source && (
                      <span className="text-xs bg-white/10 px-2 py-1 rounded">
                        {candidate.source}
                      </span>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    {candidate.current_title && (
                      <p><strong>Role:</strong> {candidate.current_title}</p>
                    )}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <p>
                        <strong>Skills:</strong>{" "}
                        <span className="text-blue-300">
                          {candidate.skills.join(", ")}
                        </span>
                      </p>
                    )}
                    {candidate.experience_years !== undefined && (
                      <p><strong>Experience:</strong> {candidate.experience_years} years</p>
                    )}
                    {candidate.linkedin_url && (
                      <p>
                        <a
                          href={candidate.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          View LinkedIn Profile →
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
        <div className="space-y-3">
          <div className="whitespace-pre-wrap">{text}</div>
          
          <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✅</span>
              <span className="font-semibold text-green-300">Job Posted Successfully</span>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Title:</strong> {data.job?.title || "N/A"}</p>
              {data.posted_to && data.posted_to.length > 0 && (
                <p>
                  <strong>Posted to:</strong>{" "}
                  <span className="text-green-300">
                    {data.posted_to.filter(Boolean).join(", ")}
                  </span>
                </p>
              )}
              {data.job?.id && (
                <p><strong>Job ID:</strong> {data.job.id}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Ticket Booking Results
    if (data.type === "SEARCH_RESULTS" || data.type === "COLLECT_DETAILS" || data.type === "INFO") {
      return (
        <div className="space-y-3">
          {/* Ticket Type Image */}
          {data.ticket_type_image && (
            <div className="mb-3">
              <img
                src={data.ticket_type_image}
                alt={data.ticket_type || "Ticket"}
                className="w-full max-w-md h-48 object-cover rounded-lg border border-white/20"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          
          <div className="whitespace-pre-wrap">{text}</div>
          
          {/* Search Results */}
          {data.type === "SEARCH_RESULTS" && data.results && (
            <div className="mt-4 space-y-3">
              <p className="font-semibold text-blue-300 mb-3">
                🎫 {data.total_options || data.results.length} Options Found:
              </p>
              {data.results.slice(0, 5).map((result: any, idx: number) => {
                const isBooking = booking[idx] || false;
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
                    className={`p-4 rounded-lg border transition-all hover:border-blue-500/50 ${
                      idx === 0 && data.best_option?.platform === result.platform
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Platform Image */}
                      {result.platform_image && (
                        <img
                          src={result.platform_image}
                          alt={result.platform}
                          className="w-16 h-16 object-contain rounded border border-white/10 bg-white/5 p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-lg">{result.platform}</h4>
                          {idx === 0 && data.best_option?.platform === result.platform && (
                            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-1 rounded">
                              🏆 Best Price
                            </span>
                          )}
                        </div>
                        <div className="text-sm space-y-1 mb-3">
                          <p className="text-xl font-bold text-green-400">
                            {result.currency_symbol || "$"}{result.price} {result.currency || "USD"}
                          </p>
                          {result.rating && (
                            <p>
                              <strong>Rating:</strong> ⭐ {result.rating}/5.0
                            </p>
                          )}
                          {result.features && result.features.length > 0 && (
                            <p>
                              <strong>Features:</strong>{" "}
                              <span className="text-blue-300">
                                {result.features.join(", ")}
                              </span>
                            </p>
                          )}
                          {result.estimated_time && (
                            <p className="text-white/60">
                              <strong>Time:</strong> {result.estimated_time}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleBookNow}
                          disabled={isBooking}
                          className={`w-full mt-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            isBooking
                              ? "bg-gray-500/30 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                          }`}
                        >
                          {isBooking ? "Processing..." : "📅 Book Now"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Price Comparison Summary */}
              {data.price_comparison && (
                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="font-semibold text-blue-300 mb-2">💰 Price Comparison:</p>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Lowest:</strong> {data.currency_symbol || data.results?.[0]?.currency_symbol || "$"}{data.price_comparison.lowest} {data.currency || data.results?.[0]?.currency || "USD"}
                    </p>
                    <p>
                      <strong>Highest:</strong> {data.currency_symbol || data.results?.[0]?.currency_symbol || "$"}{data.price_comparison.highest} {data.currency || data.results?.[0]?.currency || "USD"}
                    </p>
                    <p>
                      <strong>Average:</strong> {data.currency_symbol || data.results?.[0]?.currency_symbol || "$"}{data.price_comparison.average?.toFixed(2)} {data.currency || data.results?.[0]?.currency || "USD"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Required Fields for Booking */}
          {data.type === "COLLECT_DETAILS" && data.required_fields && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="font-semibold text-yellow-300 mb-3">📋 Required Information:</p>
              <div className="space-y-2">
                {data.required_fields.map((field: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-400">{idx + 1}.</span>
                    <span>{field.label}</span>
                    <span className="text-red-400">*</span>
                  </div>
                ))}
              </div>
              {data.optional_fields && data.optional_fields.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-500/20">
                  <p className="font-semibold text-yellow-300 mb-2">📝 Optional Information:</p>
                  <div className="space-y-2">
                    {data.optional_fields.map((field: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="text-yellow-400">{idx + 1}.</span>
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
            <div className="mt-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="font-semibold text-purple-300 mb-3">✨ I Can Help You With:</p>
              <ul className="space-y-2">
                {data.capabilities.map((cap: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-purple-400">✓</span>
                    <span>{cap}</span>
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
        <div className="space-y-3">
          <div className="whitespace-pre-wrap">{text}</div>
          
          {/* Similar Tickets Found */}
          {data.similar_tickets_found > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔍</span>
                <span className="font-semibold text-green-300">
                  Found {data.similar_tickets_found} Similar {data.similar_tickets_found === 1 ? "Ticket" : "Tickets"}
                </span>
              </div>
              <p className="text-sm text-white/80">
                I've found similar issues we've resolved before. This helps me provide you with more accurate assistance.
              </p>
            </div>
          )}
          
          {/* Question Flow Card */}
          <div className="mt-3 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">❓</span>
              <span className="font-semibold text-purple-300">Information Collection</span>
            </div>
            
            {data.next_question && (
              <div className="mb-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm font-medium text-blue-300 mb-1">Please answer:</p>
                <p className="text-white">{data.next_question}</p>
              </div>
            )}
            
            <div className="text-sm space-y-2">
              {data.issue_type && (
                <p>
                  <strong className="text-white/80">Issue Type:</strong>{" "}
                  <span className="text-white capitalize">{data.issue_type}</span>
                </p>
              )}
              {data.severity && (
                <p>
                  <strong className="text-white/80">Severity:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    data.severity === "critical" ? "bg-red-500/30 text-red-300" :
                    data.severity === "high" ? "bg-orange-500/30 text-orange-300" :
                    data.severity === "medium" ? "bg-yellow-500/30 text-yellow-300" :
                    "bg-blue-500/30 text-blue-300"
                  }`}>
                    {data.severity.toUpperCase()}
                  </span>
                </p>
              )}
              {data.priority && (
                <p>
                  <strong className="text-white/80">Priority:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    data.priority === "urgent" ? "bg-red-500/30 text-red-300" :
                    data.priority === "high" ? "bg-orange-500/30 text-orange-300" :
                    data.priority === "medium" ? "bg-yellow-500/30 text-yellow-300" :
                    "bg-blue-500/30 text-blue-300"
                  }`}>
                    {data.priority.toUpperCase()}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default: render text with formatting
    return <div className="whitespace-pre-wrap">{text}</div>;
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? "bg-white text-black rounded-br-none"
              : "bg-white/10 text-white border border-white/20 rounded-bl-none"
          }`}
        >
          {renderContent()}
        </div>
        <div className="mt-1 text-xs text-white/40 px-1">
          {isUser ? "You" : "Assistant"}
        </div>
      </div>
    </div>
  );
}

