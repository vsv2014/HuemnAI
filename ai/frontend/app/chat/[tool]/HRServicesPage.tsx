"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getJobs, logSearch, getLiveSearches, postJob, applyForJob, getEmails, postEmail } from "@/services/hrApi";
import ToolSwitcher from "@/components/ToolSwitcher";
import { X, Upload, CheckCircle, Search, Briefcase, MapPin, Clock, Mail, Plus } from "lucide-react";

interface HRServicesPageProps {
  toolName: string;
  toolId: string;
}

export default function HRServicesPage({ toolName, toolId }: HRServicesPageProps) {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [mode, setMode] = useState<"candidate" | "recruiter">("candidate");
  
  // Candidate State
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState<any | null>(null);
  const [resumeText, setResumeText] = useState("");
  
  // Recruiter State
  const [liveSearches, setLiveSearches] = useState<any[]>([]);
  const [showPostJob, setShowPostJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", description: "", requirements: "" });
  
  // Email/Announcement State
  const [emails, setEmails] = useState<any[]>([]);
  const [showPostEmail, setShowPostEmail] = useState(false);
  const [newEmail, setNewEmail] = useState({ title: "", content: "", email_address: "", type: "activity" });

  useEffect(() => {
    if (token) {
      fetchEmails(); // Fetch emails in both modes
      if (mode === "candidate") {
        fetchJobs();
      } else {
        fetchLiveSearches();
        const interval = setInterval(fetchLiveSearches, 5000); // Real-time feed
        return () => clearInterval(interval);
      }
    }
  }, [mode, token]);

  const fetchEmails = async () => {
    const data = await getEmails(token || "");
    setEmails(data);
  };

  const fetchJobs = async (query?: string) => {
    setLoadingJobs(true);
    const data = await getJobs(token || "", query);
    setJobs(data);
    setLoadingJobs(false);
  };

  const fetchLiveSearches = async () => {
    const data = await getLiveSearches(token || "");
    setLiveSearches(data);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      logSearch(searchQuery, user?.email || "anonymous", token);
      fetchJobs(searchQuery);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !token) return;

    setIsApplying(true);
    const res = await applyForJob({
        job_id: selectedJob.id,
        candidate_name: user?.name || "Anonymous Candidate",
        candidate_email: user?.email || "anonymous@example.com",
        resume_text: resumeText
    }, token);
    
    setIsApplying(false);
    if (res.success) {
        setApplicationSuccess(res);
        // Clear form after delay
        setTimeout(() => {
            setSelectedJob(null);
            setApplicationSuccess(null);
            setResumeText("");
        }, 3000);
    } else {
        alert("Failed to apply: " + res.error);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      await postJob({
        ...newJob,
        requirements: newJob.requirements.split(",").map(s => s.trim())
      }, token);
      setShowPostJob(false);
      setNewJob({ title: "", description: "", requirements: "" });
      alert("Job posted successfully!");
      // Switch to candidate view to see it? Or stay here.
      // fetchJobs(); // if we were showing jobs in recruiter view
    }
  };

  const handlePostEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      await postEmail(newEmail, token);
      setShowPostEmail(false);
      setNewEmail({ title: "", content: "", email_address: "", type: "activity" });
      fetchEmails();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-none h-14 border-b border-white/10 bg-[#0f1117]/50 backdrop-blur-md z-10">
        <div className="flex items-center justify-between px-4 h-full max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <Link 
              href="/" 
              className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
              title="Go to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </Link>
            <span className="text-white/20">|</span>
            <button 
              onClick={() => router.back()} 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back
            </button>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <h1 className="font-semibold text-white/90 truncate">HR Services 2.0</h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="bg-white/5 p-1 rounded-lg flex text-xs font-medium">
               <button 
                 onClick={() => setMode("candidate")}
                 className={`px-3 py-1.5 rounded-md transition-all ${mode === "candidate" ? "bg-blue-600 text-white shadow-lg" : "text-white/50 hover:text-white"}`}
               >
                 Candidate View
               </button>
               <button 
                 onClick={() => setMode("recruiter")}
                 className={`px-3 py-1.5 rounded-md transition-all ${mode === "recruiter" ? "bg-purple-600 text-white shadow-lg" : "text-white/50 hover:text-white"}`}
               >
                 Recruiter View
               </button>
             </div>
             <ToolSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="max-w-7xl mx-auto">
          
          {mode === "candidate" ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Candidate Hero */}
              <div className="text-center space-y-4 py-10">
                <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                  Find Your Dream Job
                </h2>
                <p className="text-white/60 max-w-xl mx-auto">
                  Our AI-powered platform matches your skills with top opportunities. 
                  Recruiters are notified instantly when you search.
                </p>
                
                <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for roles (e.g., 'Senior React Developer')..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 pl-12 text-lg focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-xl"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <button type="submit" className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-medium transition-colors">
                    Search
                  </button>
                </form>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Job List Column */}
                <div className="lg:col-span-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {loadingJobs ? (
                          [1,2,3,4].map(i => (
                            <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
                          ))
                        ) : jobs.length > 0 ? (
                          jobs.map(job => (
                            <div 
                                key={job.id} 
                                onClick={() => setSelectedJob(job)}
                                className="group bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full">AI Match</span>
                              </div>
                              <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                              <div className="flex gap-2 text-sm text-white/50 mb-4">
                                <span className="flex items-center gap-1"><Briefcase size={12}/> {job.department}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><MapPin size={12}/> {job.location}</span>
                              </div>
                              <p className="text-white/70 text-sm line-clamp-3 mb-4">{job.description}</p>
                              <div className="flex items-center justify-between mt-auto">
                                <span className="text-xs text-white/40 flex items-center gap-1"><Clock size={12}/> Posted {new Date(job.posted_at).toLocaleDateString()}</span>
                                <span className="text-blue-400 text-sm font-medium group-hover:underline">View Details →</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full text-center py-20 text-white/30">
                            No jobs found. Try searching for something else!
                          </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Announcements & Contacts */}
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 sticky top-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Mail size={16} className="text-blue-400"/> 
                            HR Announcements
                        </h3>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2">
                            {emails.map(email => (
                                <div key={email.id} className="bg-black/20 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-sm text-blue-200">{email.title}</h4>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            email.type === 'urgent' ? 'bg-red-500/20 text-red-300' : 
                                            email.type === 'activity' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                                        }`}>{new Date(email.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-white/70 mb-3">{email.content}</p>
                                    {email.email_address && (
                                        <a href={`mailto:${email.email_address}`} className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-2 rounded transition-colors w-fit">
                                            <Mail size={12} />
                                            {email.email_address}
                                        </a>
                                    )}
                                </div>
                            ))}
                            {emails.length === 0 && (
                                <div className="text-center text-white/30 text-sm py-8">
                                    No active announcements.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Recruiter Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-white/10 rounded-xl p-6">
                  <h3 className="text-white/60 text-sm font-medium mb-2">Live Candidates</h3>
                  <div className="text-3xl font-bold">{liveSearches.length > 0 ? "Active" : "Quiet"}</div>
                  <div className="text-green-400 text-sm mt-1">Real-time tracking active</div>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border border-white/10 rounded-xl p-6">
                  <h3 className="text-white/60 text-sm font-medium mb-2">Open Positions</h3>
                  <div className="text-3xl font-bold">{jobs.length}</div>
                  <div className="text-white/40 text-sm mt-1">Across 3 departments</div>
                </div>
                <div className="bg-gradient-to-br from-pink-900/40 to-rose-900/40 border border-white/10 rounded-xl p-6 flex items-center justify-center">
                   <button 
                     onClick={() => setShowPostJob(!showPostJob)}
                     className="bg-white text-black px-6 py-3 rounded-lg font-bold hover:scale-105 transition-transform shadow-xl flex items-center gap-2"
                   >
                     <Upload size={18} />
                     Post New Job
                   </button>
                </div>
              </div>

              {/* Live Talent Radar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6 min-h-[400px]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                      Live Candidate Intent Feed
                    </h3>
                    <span className="text-xs text-white/40 border border-white/10 px-2 py-1 rounded">Polling every 5s</span>
                  </div>
                  
                  <div className="space-y-4">
                    {liveSearches.length > 0 ? (
                      liveSearches.map((search) => (
                        <div key={search.id} className="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/5 hover:border-purple-500/50 transition-colors animate-in slide-in-from-left duration-300">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center font-bold text-sm">
                              {search.user.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-white/90">
                                Searching for "<span className="text-blue-300">{search.query}</span>"
                              </div>
                              <div className="text-xs text-white/40">User: {search.user}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-white/30">{search.time_ago}</span>
                            <button className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded hover:bg-purple-500 hover:text-white transition-colors">
                              Connect
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 text-white/30 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <Search size={20} />
                        </div>
                        Waiting for candidate activity...
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                    {/* Quick Post Job Form (Collapsible) */}
                    {showPostJob && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 animate-in slide-in-from-right duration-300">
                        <h3 className="font-semibold mb-4">Create New Position</h3>
                        <form onSubmit={handlePostJob} className="space-y-4">
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Job Title</label>
                            <input 
                              value={newJob.title}
                              onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                              className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm focus:border-blue-500/50 outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Requirements (comma separated)</label>
                            <input 
                              value={newJob.requirements}
                              onChange={(e) => setNewJob({...newJob, requirements: e.target.value})}
                              className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm focus:border-blue-500/50 outline-none"
                              placeholder="React, Node.js, AWS..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Description</label>
                            <textarea 
                              value={newJob.description}
                              onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                              className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm min-h-[100px] focus:border-blue-500/50 outline-none"
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button 
                              type="button"
                              onClick={() => setShowPostJob(false)}
                              className="px-4 py-2 text-sm hover:bg-white/10 rounded"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit"
                              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium"
                            >
                              Post Job
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Important Emails & Announcements */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 min-h-[300px]">
                         <div className="flex items-center justify-between mb-4">
                             <h3 className="font-semibold flex items-center gap-2">
                                 <Mail size={16} className="text-blue-400"/>
                                 Team Announcements
                             </h3>
                             <button onClick={() => setShowPostEmail(!showPostEmail)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors">
                                 {showPostEmail ? <X size={14}/> : <Plus size={14}/>}
                             </button>
                         </div>

                         {showPostEmail ? (
                             <form onSubmit={handlePostEmail} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                 <input 
                                     placeholder="Title / Subject" 
                                     className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white"
                                     value={newEmail.title}
                                     onChange={e => setNewEmail({...newEmail, title: e.target.value})}
                                     required
                                 />
                                 <input 
                                     placeholder="Email Address (Optional)" 
                                     className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white"
                                     value={newEmail.email_address}
                                     onChange={e => setNewEmail({...newEmail, email_address: e.target.value})}
                                 />
                                 <textarea 
                                     placeholder="Content / Description" 
                                     className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm min-h-[80px] text-white"
                                     value={newEmail.content}
                                     onChange={e => setNewEmail({...newEmail, content: e.target.value})}
                                     required
                                 />
                                 <select 
                                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white/80"
                                    value={newEmail.type}
                                    onChange={e => setNewEmail({...newEmail, type: e.target.value})}
                                 >
                                     <option value="activity">Company Activity</option>
                                     <option value="announcement">General Announcement</option>
                                     <option value="urgent">Urgent</option>
                                 </select>
                                 <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded text-sm font-medium">Post</button>
                             </form>
                         ) : (
                             <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                 {emails.length > 0 ? emails.map(email => (
                                     <div key={email.id} className="bg-black/20 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                                         <div className="flex justify-between items-start mb-1">
                                             <h4 className="font-medium text-sm text-white/90">{email.title}</h4>
                                             <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                 email.type === 'urgent' ? 'bg-red-500/20 text-red-300' : 
                                                 email.type === 'activity' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                                             }`}>{email.type}</span>
                                         </div>
                                         <p className="text-xs text-white/60 mb-2 line-clamp-3">{email.content}</p>
                                         {email.email_address && (
                                             <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 px-2 py-1 rounded w-fit">
                                                 <Mail size={10} />
                                                 {email.email_address}
                                             </div>
                                         )}
                                         <div className="text-[10px] text-white/20 mt-2 text-right">
                                             {new Date(email.created_at).toLocaleDateString()}
                                         </div>
                                     </div>
                                 )) : (
                                     <div className="text-center py-8 text-white/30 text-xs">
                                         No announcements yet.
                                     </div>
                                 )}
                             </div>
                         )}
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1d24] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                        <div className="flex gap-3 text-white/60 mt-2 text-sm">
                            <span className="flex items-center gap-1"><Briefcase size={14}/> {selectedJob.department}</span>
                            <span className="flex items-center gap-1"><MapPin size={14}/> {selectedJob.location}</span>
                            <span className="flex items-center gap-1"><Clock size={14}/> {new Date(selectedJob.posted_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {!applicationSuccess ? (
                        <>
                            <div>
                                <h3 className="font-semibold text-lg mb-2">About the Role</h3>
                                <p className="text-white/70 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-lg mb-2">Requirements</h3>
                                <ul className="list-disc list-inside text-white/70 space-y-1">
                                    {selectedJob.requirements?.map((req: string, i: number) => (
                                        <li key={i}>{req}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <h3 className="font-semibold mb-3">Apply Now</h3>
                                <div className="space-y-3">
                                    <textarea
                                        value={resumeText}
                                        onChange={(e) => setResumeText(e.target.value)}
                                        placeholder="Paste your resume text here (or summary of skills)..."
                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm min-h-[100px] focus:border-blue-500 outline-none"
                                    />
                                    <div className="text-xs text-white/40">
                                        * Our AI will analyze your resume text against job requirements to calculate a match score.
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Application Sent!</h3>
                            <p className="text-white/60 mb-6">Your application has been successfully submitted to the HR team.</p>
                            
                            <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-white/10 rounded-xl p-6 w-full max-w-sm">
                                <div className="text-sm text-white/60 uppercase tracking-wider mb-2">AI Match Score</div>
                                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                    {applicationSuccess.match_score}%
                                </div>
                                <p className="text-xs text-white/40 mt-2">Based on your skills and experience</p>
                            </div>
                        </div>
                    )}
                </div>

                {!applicationSuccess && (
                    <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-[#1a1d24]">
                        <button 
                            onClick={() => setSelectedJob(null)}
                            className="px-4 py-2 hover:bg-white/5 rounded-lg text-white/70 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleApply}
                            disabled={isApplying || !resumeText.trim()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isApplying ? "Submitting..." : "Submit Application"}
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}