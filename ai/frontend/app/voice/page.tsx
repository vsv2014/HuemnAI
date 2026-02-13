"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  Pause, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Copy, 
  Search,
  Settings,
  Mic,
  Volume2,
  ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getVoiceProfiles, deleteVoiceProfile, cloneVoice, updateVoiceProfile, syncHuemnVoices, startToolSession } from "@/services/api";
import TrialBanner from "@/components/TrialBanner";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10
    }
  }
};

// --- Types ---

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface VoiceProfile {
  id: number;
  name: string;
  description: string;
  provider: string;
  provider_voice_id: string;
  category: string;
  gender: string;
  language: string;
  accent: string;
  sample_url: string;
  is_public: boolean;
  is_cloned: boolean;
  user_id: number;
  settings: VoiceSettings;
}

// --- Icons ---

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const WaveformIcon = () => (
  <div className="flex items-end gap-[2px] h-4">
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="w-1 bg-indigo-500 rounded-t-sm"
        animate={{ height: ["20%", "100%", "40%", "80%", "30%"] }}
        transition={{ 
          duration: 0.8, 
          repeat: Infinity, 
          ease: "linear",
          delay: i * 0.1 
        }}
      />
    ))}
  </div>
);

// --- Components ---

const TabButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
        : "text-white/60 hover:text-white hover:bg-white/5"
    }`}
  >
    {children}
  </button>
);

const VoiceCard = ({ 
  profile, 
  isPlaying, 
  onPlay, 
  onEdit, 
  onDelete,
  isAdmin 
}: { 
  profile: VoiceProfile, 
  isPlaying: boolean, 
  onPlay: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
  isAdmin: boolean
}) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-[#13141c] border border-white/5 rounded-xl p-4 hover:border-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            profile.is_cloned 
              ? "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20" 
              : "bg-gradient-to-br from-gray-700 to-gray-600"
          }`}>
            {profile.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
              {profile.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className="capitalize">{profile.gender}</span>
              <span>•</span>
              <span className="capitalize">{profile.language}</span>
            </div>
          </div>
        </div>
        
        {/* Play Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isPlaying 
              ? "bg-indigo-500 text-white" 
              : "bg-white/5 text-white/60 hover:bg-indigo-500 hover:text-white"
          }`}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Stability</span>
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500/50" 
              style={{ width: `${(profile.settings?.stability || 0.5) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Similarity</span>
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500/50" 
              style={{ width: `${(profile.settings?.similarity_boost || 0.75) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className={`text-[10px] px-2 py-1 rounded-full border ${
          profile.is_cloned 
            ? "border-purple-500/20 text-purple-400 bg-purple-500/10" 
            : "border-white/10 text-white/40 bg-white/5"
        }`}>
          {profile.category || "General"}
        </span>

        <div className="flex gap-1">
          <button 
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Settings"
          >
            <SettingsIcon />
          </button>
          {(isAdmin || profile.is_cloned) && (
            <button 
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Playing Visualizer Overlay */}
      {isPlaying && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <WaveformIcon />
            <span className="text-xs font-medium text-indigo-400">Playing Preview...</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- Main Page ---

export default function VoiceStudio() {
  const router = useRouter();
  const { token, user, isAuthenticated } = useAuthStore();
  
  // Data State
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'all' | 'cloned' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Modal State
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState<VoiceProfile | null>(null);

  // Clone Form State
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloning, setCloning] = useState(false);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<VoiceSettings>({ stability: 0.5, similarity_boost: 0.75 });
  const [savingSettings, setSavingSettings] = useState(false);

  // --- Effects ---

  useEffect(() => {
    if (isAuthenticated && token) {
      startToolSession("voice_studio", token).catch(() => {});
      loadProfiles();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      startToolSession("voice_studio", token).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Audio Handling
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // --- Actions ---

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await getVoiceProfiles(token!);
      if (res.success) {
        setProfiles(res.profiles);
      } else {
        showToast(res.error || "Failed to load voices", 'error');
      }
    } catch (e) {
      showToast("Network error loading voices", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncHuemnVoices(token!);
      if (res.success) {
        await loadProfiles();
        showToast("System voices synced successfully", 'success');
      } else {
        showToast("Sync failed: " + res.error, 'error');
      }
    } catch (e) {
      showToast("Sync error", 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this voice?")) return;
    try {
      const res = await deleteVoiceProfile(id, token!);
      if (res.success) {
        setProfiles(prev => prev.filter(p => p.id !== id));
        showToast("Voice deleted", 'success');
      } else {
        showToast("Delete failed", 'error');
      }
    } catch (e) {
      showToast("Delete error", 'error');
    }
  };

  const handlePlay = (profile: VoiceProfile) => {
    if (playingId === profile.id) {
      // Stop
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play new
      if (audioRef.current) audioRef.current.pause();
      
      if (!profile.sample_url) {
        showToast("No preview available for this voice", 'error');
        return;
      }

      const audio = new Audio(profile.sample_url);
      audioRef.current = audio;
      audio.play().catch(e => showToast("Failed to play audio", 'error'));
      setPlayingId(profile.id);
      
      audio.onended = () => setPlayingId(null);
    }
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneFiles.length) {
      showToast("Please upload at least one sample", 'error');
      return;
    }

    setCloning(true);
    try {
      const res = await cloneVoice(cloneName, cloneDesc, cloneFiles, token!);
      if (res.success) {
        setShowCloneModal(false);
        setCloneName("");
        setCloneDesc("");
        setCloneFiles([]);
        loadProfiles();
        showToast("Voice cloned successfully!", 'success');
      } else {
        showToast("Cloning failed: " + (res.error || res.detail), 'error');
      }
    } catch (e) {
      showToast("Network error during cloning", 'error');
    } finally {
      setCloning(false);
    }
  };

  const openSettings = (profile: VoiceProfile) => {
    setSettingsForm(profile.settings || { stability: 0.5, similarity_boost: 0.75 });
    setShowSettingsModal(profile);
  };

  const saveSettings = async () => {
    if (!showSettingsModal) return;
    setSavingSettings(true);
    try {
      const res = await updateVoiceProfile(showSettingsModal.id, { settings: settingsForm }, token!);
      if (res.success || !res.error) { // Handling different response structures
        setProfiles(prev => prev.map(p => 
          p.id === showSettingsModal.id ? { ...p, settings: settingsForm } : p
        ));
        setShowSettingsModal(null);
        showToast("Settings updated", 'success');
      } else {
        showToast("Update failed: " + res.error, 'error');
      }
    } catch (e) {
      showToast("Update error", 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Filtering ---

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === 'cloned') return p.is_cloned;
    if (activeTab === 'system') return !p.is_cloned;
    return true;
  });

  return (
    <div className="min-h-screen w-full bg-[#0a0a0f] text-white p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm">
              <Link href="/" className="text-white/40 hover:text-white transition-colors">Home</Link>
              <span className="text-white/20">/</span>
              <span className="text-indigo-400">Voice Studio</span>
            </div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Voice Studio
            </h1>
            <p className="text-white/60 mt-2 max-w-xl">
              Design, clone, and fine-tune your AI voices. Manage your personal voice library and configure advanced speech parameters.
            </p>
          </div>

          <div className="flex gap-3">
            {user?.role === "admin" && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
              >
                <span className={syncing ? "animate-spin" : ""}>↻</span>
                {syncing ? "Syncing..." : "Sync System"}
              </button>
            )}
            <button
              onClick={() => setShowCloneModal(true)}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
            >
              <PlusIcon />
              <span>Clone Voice</span>
            </button>
          </div>
        </div>

        <TrialBanner minimal />

        {/* Controls Bar */}
        <div className="sticky top-4 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex bg-white/5 p-1 rounded-lg">
            <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>All Voices</TabButton>
            <TabButton active={activeTab === 'cloned'} onClick={() => setActiveTab('cloned')}>Cloned</TabButton>
            <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')}>System</TabButton>
          </div>

          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search voices by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#13141c] border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-24 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No voices found</h3>
            <p className="text-white/40">Try adjusting your filters or clone a new voice.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProfiles.map(profile => (
                <VoiceCard 
                  key={profile.id} 
                  profile={profile} 
                  isPlaying={playingId === profile.id}
                  onPlay={() => handlePlay(profile)}
                  onEdit={() => openSettings(profile)}
                  onDelete={() => handleDelete(profile.id)}
                  isAdmin={user?.role === "admin"}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* --- Modals --- */}

      {/* Clone Modal */}
      <AnimatePresence>
        {showCloneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowCloneModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#181924] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-bold text-white">Clone a New Voice</h2>
                <p className="text-sm text-white/50">Upload clear audio samples to generate a custom voice.</p>
              </div>
              
              <form onSubmit={handleCloneSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Voice Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-indigo-500/50 focus:outline-none"
                    value={cloneName} onChange={e => setCloneName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                  <textarea 
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-indigo-500/50 focus:outline-none h-20 resize-none"
                    value={cloneDesc} onChange={e => setCloneDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Audio Samples</label>
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                    <input 
                      type="file" multiple accept="audio/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={e => setCloneFiles(Array.from(e.target.files || []))}
                    />
                    <div className="text-indigo-400 mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <p className="text-sm text-white/60">
                      {cloneFiles.length > 0 
                        ? `${cloneFiles.length} files selected` 
                        : "Drag & drop or click to upload"}
                    </p>
                    <p className="text-xs text-white/30 mt-1">MP3, WAV, M4A up to 10MB</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowCloneModal(false)}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={cloning}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {cloning && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {cloning ? "Cloning..." : "Create Voice"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowSettingsModal(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#181924] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-bold text-white">Voice Settings</h2>
                <p className="text-sm text-white/50">Configure speech parameters for {showSettingsModal.name}</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-white/80">Stability</label>
                    <span className="text-sm text-indigo-400">{Math.round(settingsForm.stability * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01"
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    value={settingsForm.stability}
                    onChange={e => setSettingsForm({ ...settingsForm, stability: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-white/40 mt-1">Lower values are more expressive but less stable.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-white/80">Similarity Boost</label>
                    <span className="text-sm text-purple-400">{Math.round(settingsForm.similarity_boost * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01"
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    value={settingsForm.similarity_boost}
                    onChange={e => setSettingsForm({ ...settingsForm, similarity_boost: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-white/40 mt-1">Higher values match the original voice more closely.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => setShowSettingsModal(null)}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium disabled:opacity-50"
                  >
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-xl shadow-2xl backdrop-blur-md border flex items-center gap-3 ${
              toast.type === 'success' 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
