import React, { useState } from 'react';
import type { ChatUser, RoomMember, TypingUser } from '../types';
import { 
  Users, 
  Circle, 
  Search, 
  X, 
  Shield, 
  ChevronLeft,
  Sparkles,
  Clock
} from 'lucide-react';

interface UserSidebarProps {
  currentUser: ChatUser | null;
  members: RoomMember[];
  typingUsers: TypingUser[];
  isOpen: boolean;
  onClose: () => void;
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-indigo-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatLastActive(lastActive?: { seconds: number; nanoseconds: number } | null): string {
  if (!lastActive || !lastActive.seconds) return 'Just joined';
  const diffSec = Math.floor(Date.now() / 1000) - lastActive.seconds;
  if (diffSec < 60) return 'Active just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export const UserSidebar: React.FC<UserSidebarProps> = ({
  currentUser,
  members,
  typingUsers,
  isOpen,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  // Combine and deduplicate members from database with current user
  const allList: RoomMember[] = [];
  const seenIds = new Set<string>();

  if (currentUser) {
    seenIds.add(currentUser.uid);
    allList.push({
      userId: currentUser.uid,
      displayName: currentUser.displayName,
      isOnline: true,
      lastActive: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    });
  }

  members.forEach((m) => {
    if (!seenIds.has(m.userId)) {
      seenIds.add(m.userId);
      allList.push(m);
    }
  });

  const onlineCount = allList.filter((m) => m.isOnline).length;

  const filtered = allList.filter((m) =>
    (m.displayName || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Left Sidebar Panel */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-20 w-72 sm:w-80 bg-slate-900/98 md:bg-slate-900/80 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Room Members
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {allList.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{onlineCount} currently online</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Search Bar (if more than 3 members) */}
        {allList.length > 3 && (
          <div className="p-2.5 border-b border-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter members..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Members List Container */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 divide-y divide-slate-800/30">
          
          {/* "YOU" Section */}
          {currentUser && (
            <div className="pb-2">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                You (Current User)
              </div>
              <div className="px-2.5 py-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-between group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarColor(
                        currentUser.displayName
                      )} text-white font-bold text-xs flex items-center justify-center shadow-md`}
                    >
                      {(currentUser.displayName || 'U')[0].toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900"></span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                        {currentUser.displayName}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-200 font-medium">
                        You
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Online now
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* "ALL MEMBERS WHO ENTERED" Section */}
          <div className="pt-2 space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>All Website Users ({filtered.length})</span>
              <span className="text-[9px] text-slate-500 font-normal">Real Data</span>
            </div>

            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No users found matching &quot;{filterQuery}&quot;
              </div>
            ) : (
              filtered.map((member) => {
                const isSelf = currentUser && currentUser.uid === member.userId;
                if (isSelf) return null; // already shown in "You" section

                const isTyping = typingUsers.some((t) => t.userId === member.userId);

                return (
                  <div
                    key={member.userId}
                    className="px-2.5 py-2 rounded-xl hover:bg-slate-800/50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarColor(
                            member.displayName || 'Member'
                          )} text-white font-bold text-xs flex items-center justify-center shadow-xs`}
                        >
                          {(member.displayName || 'M')[0].toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                            member.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        ></span>
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate group-hover:text-white">
                          {member.displayName}
                        </div>

                        {isTyping ? (
                          <span className="text-[10px] text-purple-400 font-medium flex items-center gap-1 animate-pulse">
                            typing...
                          </span>
                        ) : member.isOnline ? (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                            Online
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatLastActive(member.lastActive)}
                          </span>
                        )}
                      </div>
                    </div>

                    {member.isOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-slate-400 text-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Public Chat Room
          </span>
          <span className="font-mono text-[10px] text-emerald-400">
            Cloud SQL Real Data
          </span>
        </div>
      </aside>
    </>
  );
};
