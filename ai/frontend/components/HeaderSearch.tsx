"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HeaderSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    
    // Route to knowledge page with search query
    router.push(`/knowledge?q=${encodeURIComponent(searchQuery.trim())}`);
    
    // Reset after navigation
    setTimeout(() => {
      setSearchQuery("");
      setIsOpen(false);
      setIsSearching(false);
    }, 100);
  };

  const handleSearchIconClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div ref={searchContainerRef} className="relative">
      {!isOpen ? (
        // Search Icon Button
        <button
          onClick={handleSearchIconClick}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors active:scale-95"
          title="Search"
          aria-label="Open search"
        >
          <span className="text-lg sm:text-xl">🔍</span>
        </button>
      ) : (
        // Expanded Search Bar
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge base, tickets, solutions..."
              className="w-48 sm:w-64 px-3 sm:px-4 py-2 pl-8 sm:pl-10 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              onBlur={(e) => {
                // Don't close if clicking on search button
                if (!e.relatedTarget || !searchContainerRef.current?.contains(e.relatedTarget as Node)) {
                  // Small delay to allow button click
                  setTimeout(() => {
                    if (!searchQuery.trim()) {
                      setIsOpen(false);
                    }
                  }, 200);
                }
              }}
            />
            <div className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-white/40 pointer-events-none text-sm sm:text-base">
              🔍
            </div>
            {searchQuery && (
              <button
                type="submit"
                disabled={isSearching}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors active:scale-95"
              >
                {isSearching ? "..." : "Search"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery("");
              }}
              className="px-2 py-2 text-white/60 hover:text-white transition-colors active:scale-95"
              aria-label="Close search"
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

