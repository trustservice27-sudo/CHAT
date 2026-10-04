/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import type { ChatMessage, ChatUser, OnlineUser, TypingUser } from './types';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { TypingIndicator } from './components/TypingIndicator';
import { AuthModal } from './components/AuthModal';
import { ClearModal } from './components/ClearModal';
import { InfoModal } from './components/InfoModal';
import { playNotificationSound } from './utils/sound';
import { Loader2 } from 'lucide-react';

// Authoritative synchronization with server state:
// 1. If server is empty/cleared -> immediately empty!
// 2. Never restore messages that were deleted on the server.
// 3. Only keep pending unconfirmed messages sent in the last 4 seconds.
function syncServerMessages(existing: ChatMessage[], serverMsgs: ChatMessage[]): ChatMessage[] {
  if (!serverMsgs || serverMsgs.length === 0) {
    return [];
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const pendingOptimistic = existing.filter(
    (m) => m.id.startsWith('temp_') && (nowSec - (m.createdAt?.seconds || 0) < 4)
  );

  const serverMap = new Map<string, ChatMessage>();
  serverMsgs.forEach((m) => serverMap.set(m.id, m));

  // Retain pending optimistic messages only if not already confirmed by server
  pendingOptimistic.forEach((opt) => {
    const alreadyOnServer = serverMsgs.some(
      (s) => s.userId === opt.userId && s.text === opt.text
    );
    if (!alreadyOnServer) {
      serverMap.set(opt.id, opt);
    }
  });

  return Array.from(serverMap.values()).sort((a, b) => {
    const tA = (a.createdAt?.seconds || 0) * 1000 + (a.createdAt?.nanoseconds || 0) / 1000000;
    const tB = (b.createdAt?.seconds || 0) * 1000 + (b.createdAt?.nanoseconds || 0) / 1000000;
    return tA - tB;
  });
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(() => {
    try {
      const saved = localStorage.getItem('openchat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem('openchat_messages_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Synchronize local cache with current message state
  useEffect(() => {
    try {
      if (messages.length === 0) {
        localStorage.removeItem('openchat_messages_cache');
      } else {
        localStorage.setItem('openchat_messages_cache', JSON.stringify(messages.slice(-200)));
      }
    } catch {}
  }, [messages]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // Audio & Clear Tracking
  const initialLoadDone = useRef(false);
  const isTypingActiveRef = useRef(false);
  const lastKnownCountRef = useRef(messages.length);
  const lastClearTsRef = useRef<number>(
    (() => {
      try {
        return Number(localStorage.getItem('openchat_clear_ts') || '0');
      } catch {
        return 0;
      }
    })()
  );

  // Action to wipe messages across state and storage
  const wipeAllMessagesLocal = (clearTs?: number) => {
    setMessages([]);
    lastKnownCountRef.current = 0;
    if (clearTs) {
      lastClearTsRef.current = clearTs;
      try {
        localStorage.setItem('openchat_clear_ts', String(clearTs));
      } catch {}
    }
    try {
      localStorage.removeItem('openchat_messages_cache');
    } catch {}
  };

  // Helper to fetch authoritative message list from server
  const fetchAuthoritativeMessages = () => {
    fetch('/api/messages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.lastClearTimestamp && data.lastClearTimestamp > lastClearTsRef.current) {
            wipeAllMessagesLocal(data.lastClearTimestamp);
            return;
          }

          if (Array.isArray(data.messages)) {
            if (data.messages.length === 0) {
              wipeAllMessagesLocal();
            } else {
              setMessages((prev) => syncServerMessages(prev, data.messages));
              lastKnownCountRef.current = data.messages.length;
            }
          }
          setMessagesLoading(false);
          initialLoadDone.current = true;
        }
      })
      .catch((err) => console.warn('Message fetch note:', err));
  };

  // 1. Initial Load & Real-Time SSE Stream
  useEffect(() => {
    fetchAuthoritativeMessages();

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init') {
            if (data.lastClearTimestamp && data.lastClearTimestamp > lastClearTsRef.current) {
              wipeAllMessagesLocal(data.lastClearTimestamp);
            } else if (Array.isArray(data.messages)) {
              if (data.messages.length === 0) {
                wipeAllMessagesLocal();
              } else {
                setMessages((prev) => syncServerMessages(prev, data.messages));
                lastKnownCountRef.current = data.messages.length;
              }
            }
            if (Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            if (Array.isArray(data.typingUsers)) {
              setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));
            }
            setMessagesLoading(false);
            initialLoadDone.current = true;

          } else if (data.type === 'new_message' && data.message) {
            setMessages((prev) => {
              // Add new message and avoid duplicate IDs
              if (prev.some((m) => m.id === data.message.id)) return prev;
              const filtered = prev.filter(
                (m) => !(m.id.startsWith('temp_') && m.userId === data.message.userId && m.text === data.message.text)
              );
              return [...filtered, data.message];
            });
            lastKnownCountRef.current += 1;
            setMessagesLoading(false);

            if (currentUser && data.message.userId !== currentUser.uid && soundEnabled) {
              playNotificationSound();
            }

          } else if (data.type === 'presence' && Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);

          } else if (data.type === 'typing' && Array.isArray(data.typingUsers)) {
            setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));

          } else if (data.type === 'clear') {
            // Immediate real-time clear received from another user!
            wipeAllMessagesLocal(data.lastClearTimestamp || Date.now());
          }
        } catch (err) {
          console.warn('Error reading event stream:', err);
        }
      };

      eventSource.onerror = () => {
        // Automatically reconnects
      };
    } catch (e) {
      console.warn('Event stream init:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentUser, soundEnabled]);

  // 2. High-Frequency Fallback Polling (Every 1.5 seconds)
  // Guarantees all phones and laptops see changes, clears, presence, and messages in real-time
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/online-status');
        const data = await res.json();
        if (data.success) {
          // Check if another user cleared the chat room!
          if (data.lastClearTimestamp && data.lastClearTimestamp > lastClearTsRef.current) {
            wipeAllMessagesLocal(data.lastClearTimestamp);
            return;
          }

          if (data.messageCount === 0 && messages.length > 0) {
            wipeAllMessagesLocal();
            return;
          }

          if (Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);
          }
          if (Array.isArray(data.typingUsers)) {
            setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));
          }

          // If server message count changed, pull updates immediately
          if (typeof data.messageCount === 'number' && data.messageCount !== lastKnownCountRef.current) {
            fetchAuthoritativeMessages();
          }
        }
      } catch {}
    };

    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [currentUser, messages.length]);

  // 3. Online Presence Heartbeat
  useEffect(() => {
    if (!currentUser) return;

    const pingOnlinePresence = () => {
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          displayName: currentUser.displayName,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.onlineUsers && Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);
          }
        })
        .catch(() => {});
    };

    pingOnlinePresence();
    const interval = setInterval(pingOnlinePresence, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Join handler
  const handleJoin = async (user: ChatUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('openchat_user', JSON.stringify(user));
      localStorage.setItem('openchat_uid', user.uid);
    } catch {}

    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        displayName: user.displayName,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.onlineUsers && Array.isArray(data.onlineUsers)) {
          setOnlineUsers(data.onlineUsers);
        }
      })
      .catch(() => {});
  };

  // Leave room handler
  const handleSignOut = () => {
    if (currentUser) {
      fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          displayName: currentUser.displayName,
          isTyping: false,
        }),
      }).catch(() => {});
    }

    setCurrentUser(null);
    try {
      localStorage.removeItem('openchat_user');
      localStorage.removeItem('openchat_uid');
    } catch {}
  };

  // Broadcast typing status
  const handleTyping = (isTyping: boolean) => {
    if (!currentUser || isTypingActiveRef.current === isTyping) return;
    isTypingActiveRef.current = isTyping;

    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.typingUsers && Array.isArray(data.typingUsers)) {
          setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));
        }
      })
      .catch(() => {});
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!currentUser) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    // Instant optimistic render
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      userId: currentUser.uid,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      text: trimmed,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      readBy: [currentUser.uid],
      seenBy: [],
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    lastKnownCountRef.current += 1;

    // Save to server
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          displayName: currentUser.displayName,
          text: trimmed,
          photoURL: currentUser.photoURL,
        }),
      });
      const data = await res.json();
      if (data?.message) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === data.message.id)) return withoutTemp;
          return [...withoutTemp, data.message];
        });
      }
    } catch (err) {
      console.warn('Message send note:', err);
    }

    // Clear typing status
    isTypingActiveRef.current = false;
    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping: false,
      }),
    }).catch(() => {});
  };

  // Reset Everything handler
  const handleResetEverything = () => {
    wipeAllMessagesLocal(Date.now());
    setOnlineUsers([]);
    setTypingUsers([]);
    setCurrentUser(null);
    try {
      localStorage.removeItem('openchat_user');
      localStorage.removeItem('openchat_uid');
    } catch {}
  };

  // Filter messages based on search query
  const filteredMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.text.toLowerCase().includes(q) ||
      m.displayName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenClearModal={() => setClearModalOpen(true)}
        onOpenInfoModal={() => setInfoModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        messageCount={messages.length}
      />

      {/* Online Status Bar */}
      {currentUser && (
        <div className="shrink-0 bg-slate-900/60 border-b border-slate-800/80 px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online ({Math.max(1, onlineUsers.length)}):
            </span>
            <div className="flex items-center -space-x-1 shrink-0">
              {onlineUsers.slice(0, 8).map((u) => (
                <div 
                  key={u.userId}
                  title={`${u.displayName} (Online)`}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-600/80 border border-slate-700 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center ring-1 ring-slate-900"
                >
                  {(u.displayName || 'M')[0].toUpperCase()}
                </div>
              ))}
            </div>
            {onlineUsers.length > 8 && (
              <span className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.5 rounded-full shrink-0">
                +{onlineUsers.length - 8}
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline-flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Synced
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {!currentUser ? (
          /* Simple Instant Name Login Screen */
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <AuthModal onJoin={handleJoin} />
          </div>
        ) : (
          /* Live Chat Room Layout */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {messagesLoading && messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Connecting to chat room...</span>
              </div>
            ) : (
              <MessageList
                messages={filteredMessages}
                currentUser={currentUser}
                searchQuery={searchQuery}
                scrollTrigger={scrollTrigger}
              />
            )}

            {/* Real-time Typing Indicator */}
            <TypingIndicator typingUsers={typingUsers} />

            {/* Message input bar */}
            <MessageComposer
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onFocusInput={() => setScrollTrigger((prev) => prev + 1)}
              onTyping={handleTyping}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <ClearModal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        currentUser={currentUser}
        onCleared={() => {
          wipeAllMessagesLocal(Date.now());
        }}
        onResetAll={handleResetEverything}
      />

      <InfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
      />

    </div>
  );
}
