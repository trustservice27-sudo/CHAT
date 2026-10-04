import React, { useState } from 'react';
import { 
  Trash2, 
  Search, 
  Volume2, 
  VolumeX, 
  Info, 
  LogOut, 
  X,
  Bell,
  Users
} from 'lucide-react';
import type { ChatUser } from '../types';
import { playNotificationSound, unlockAudioContext } from '../utils/sound';

interface HeaderProps {
  currentUser: ChatUser | null;
  onSignOut: () => void;
  onOpenClearModal: () => void;
  onOpenInfoModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  messageCount: number;
  matchedCount?: number;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onlineCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSignOut,
  onOpenClearModal,
  onOpenInfoModal,
  soundEnabled,
  onToggleSound,
  searchQuery,
  onSearchChange,
  messageCount,
  matchedCount,
  onToggleSidebar,
  isSidebarOpen,
  onlineCount,
}) => {
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const handleToggleSoundWithFeedback = () => {
    unlockAudioContext();
    if (!soundEnabled) {
      // Preview the chime when user turns sound on
      setTimeout(() => {
        playNotificationSound();
      }, 50);
    }
    onToggleSound();
  };

  return (
    <header className="shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-sm z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Sidebar Toggle + Logo and Room Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          {currentUser && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 ${
                isSidebarOpen
                  ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Toggle Members Sidebar"
              aria-label="Toggle Members Sidebar"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              {typeof onlineCount === 'number' && (
                <span className="text-[10px] font-semibold text-emerald-400 hidden sm:inline">
                  {onlineCount}
                </span>
              )}
            </button>
          )}

          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1.5px] shadow-md shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <span className="text-base sm:text-lg font-bold bg-gradient-to-tr from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                OC
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-sm sm:text-base tracking-tight text-white truncate">
                OpenChat
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'} online
            </p>
          </div>
        </div>

        {/* Responsive Desktop / Tablet Search Bar */}
        {currentUser && (
          <div className="hidden sm:flex flex-1 max-w-xs md:max-w-md items-center relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search chat messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl pl-9 pr-16 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
            {searchQuery ? (
              <div className="absolute right-2 flex items-center gap-1.5">
                {typeof matchedCount === 'number' && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md font-mono">
                    {matchedCount} found
                  </span>
                )}
                <button
                  onClick={() => onSearchChange('')}
                  className="text-slate-400 hover:text-white p-0.5"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Mobile Search Overlay */}
        {showMobileSearch && (
          <div className="absolute inset-x-2 top-2 z-50 bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            <input
              type="text"
              placeholder="Search chat messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-400 focus:outline-none py-1"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setShowMobileSearch(false);
                onSearchChange('');
              }}
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-medium shrink-0"
            >
              Done
            </button>
          </div>
        )}

        {/* Actions Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Mobile Search Toggle button */}
          {currentUser && !showMobileSearch && (
            <button
              onClick={() => setShowMobileSearch(true)}
              className={`sm:hidden p-2 rounded-xl transition-colors ${
                searchQuery ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
              }`}
              title="Search messages"
              aria-label="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Chime Sound Toggle */}
          <button
            onClick={handleToggleSoundWithFeedback}
            className={`p-2 rounded-xl transition-all relative flex items-center justify-center ${
              soundEnabled 
                ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 active:bg-slate-800' 
                : 'text-slate-500 hover:text-slate-300 active:bg-slate-800'
            }`}
            title={soundEnabled ? 'Chime notifications active (Click to mute)' : 'Chime notifications muted (Click to unmute)'}
            aria-label="Toggle chime notification sound"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              </>
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Info Button */}
          <button
            onClick={onOpenInfoModal}
            className="p-2 text-slate-400 hover:text-indigo-300 active:bg-slate-800 rounded-xl transition-colors"
            title="Room details & information"
            aria-label="Information"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* CLEAR Room Button */}
          <button
            onClick={onOpenClearModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold tracking-wide transition-colors shadow-xs"
            title="Clear Chat Room (Requires Admin Passcode)"
            aria-label="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CLEAR</span>
          </button>

          {/* User Sign Out */}
          {currentUser && (
            <button
              onClick={onSignOut}
              className="p-2 text-slate-400 hover:text-rose-400 active:bg-slate-800 rounded-xl transition-colors"
              title="Leave Room"
              aria-label="Leave room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
