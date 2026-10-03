import React from 'react';
import { 
  Trash2, 
  Search, 
  Volume2, 
  VolumeX, 
  Info, 
  LogOut, 
  X
} from 'lucide-react';
import type { ChatUser } from '../types';

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
}) => {
  const [showSearch, setShowSearch] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-sm transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Logo and Room Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1.5px] shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <span className="text-xl font-bold bg-gradient-to-tr from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                OC
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white truncate">
                OpenChat
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Public Room
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden xs:block truncate">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'} stored in Firestore
            </p>
          </div>
        </div>

        {/* Search Bar (Expandable on mobile) */}
        {showSearch && (
          <div className="absolute inset-x-4 top-2 z-40 bg-slate-800 rounded-xl p-2 shadow-xl border border-slate-700 flex items-center gap-2 md:static md:inset-auto md:bg-slate-800/80 md:w-64 md:p-1.5 md:border-slate-700/60">
            <Search className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-400 focus:outline-none"
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
                setShowSearch(false);
                onSearchChange('');
              }}
              className="md:hidden text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
            >
              Close
            </button>
          </div>
        )}

        {/* Actions Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Toggle button */}
          {!showSearch && (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
              title="Search messages"
              aria-label="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled 
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' 
                : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/50'
            }`}
            title={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
            aria-label="Toggle sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Info Button */}
          <button
            onClick={onOpenInfoModal}
            className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 rounded-lg transition-colors"
            title="App Architecture & Setup Guide"
            aria-label="Information"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* CLEAR Button (Prominent in Header as requested) */}
          <button
            onClick={onOpenClearModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-rose-950/40"
            title="Clear all public chat messages (Password required)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>CLEAR</span>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block"></div>

          {/* User Profile & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-1">
              <div 
                className="flex items-center gap-2 group relative"
                title={currentUser.displayName || 'Member'}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs ring-2 ring-indigo-500/30 shadow-inner">
                    {(currentUser.displayName || 'M')[0].toUpperCase()}
                  </div>
                )}

                <div className="hidden lg:block text-left text-xs">
                  <span className="font-medium text-slate-200 truncate max-w-[120px] block">
                    {currentUser.displayName || 'Member'}
                  </span>
                  <span className="text-[10px] text-emerald-400 block truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Online
                  </span>
                </div>
              </div>

              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors ml-1"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
