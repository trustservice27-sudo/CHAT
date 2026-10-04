/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import type { ChatMessage, ChatUser, OnlineUser, RoomMember, TypingUser } from './types';
import { Header } from './components/Header';
import { UserSidebar } from './components/UserSidebar';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { TypingIndicator } from './components/TypingIndicator';
import { AuthModal } from './components/AuthModal';
import { ClearModal } from './components/ClearModal';
import { InfoModal } from './components/InfoModal';
import { playNotificationSound } from './utils/sound';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(() => {
    try {
      const saved = localStorage.getItem('openchat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 100% Online Cloud Database Storage (No local caching of messages)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // Tracking refs
  const isTypingActiveRef = useRef(false);
  const lastKnownCountRef = useRef(0);
  const lastClearTsRef = useRef<number | null>(null);

  // Fetch all chat history and members directly from online cloud database
  const fetchOnlineData = () => {
    fetch('/api/messages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.messages)) {
          if (lastClearTsRef.current === null) {
            lastClearTsRef.current = data.lastClearTimestamp || Date.now();
            setMessages(data.messages);
            lastKnownCountRef.current = data.messages.length;
          } else if (data.lastClearTimestamp && data.lastClearTimestamp > lastClearTsRef.current) {
            lastClearTsRef.current = data.lastClearTimestamp;
            setMessages([]);
            lastKnownCountRef.current = 0;
          } else {
            setMessages(data.messages);
            lastKnownCountRef.current = data.messages.length;
          }
        }
        setMessagesLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching online messages:', err);
        setMessagesLoading(false);
      });

    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setMembers(data.users);
        }
      })
      .catch(() => {});
  };

  // 1. Initial Load & Real-Time SSE Stream
  useEffect(() => {
    fetchOnlineData();

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init') {
            if (Array.isArray(data.messages)) {
              setMessages(data.messages);
              lastKnownCountRef.current = data.messages.length;
            }
            if (Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            if (Array.isArray(data.allUsers)) {
              setMembers(data.allUsers);
            }
            if (Array.isArray(data.typingUsers)) {
              setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));
            }
            if (data.lastClearTimestamp) {
              lastClearTsRef.current = data.lastClearTimestamp;
            }
            setMessagesLoading(false);

          } else if (data.type === 'new_message' && data.message) {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) => !(m.id.startsWith('temp_') && m.userId === data.message.userId && m.text === data.message.text)
              );
              if (filtered.some((m) => m.id === data.message.id)) {
                return filtered;
              }
              return [...filtered, data.message];
            });
            lastKnownCountRef.current += 1;
            setMessagesLoading(false);

            if (currentUser && data.message.userId !== currentUser.uid && soundEnabled) {
              playNotificationSound();
            }

          } else if (data.type === 'presence') {
            if (Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            if (Array.isArray(data.allUsers)) {
              setMembers(data.allUsers);
            }

          } else if (data.type === 'typing' && Array.isArray(data.typingUsers)) {
            setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));

          } else if (data.type === 'clear') {
            setMessages([]);
            lastKnownCountRef.current = 0;
            if (data.lastClearTimestamp) {
              lastClearTsRef.current = data.lastClearTimestamp;
            }
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

  // 2. High-Frequency Online Sync Polling (Every 1.5 seconds)
  // Queries online cloud database continuously for instant cross-device synchronization
  useEffect(() => {
    const pollOnlineDatabase = async () => {
      try {
        const res = await fetch('/api/online-status');
        const data = await res.json();
        if (data.success) {
          if (lastClearTsRef.current !== null && data.lastClearTimestamp && data.lastClearTimestamp > lastClearTsRef.current) {
            lastClearTsRef.current = data.lastClearTimestamp;
            setMessages([]);
            lastKnownCountRef.current = 0;
            return;
          }

          if (Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);
          }
          if (Array.isArray(data.allUsers)) {
            setMembers(data.allUsers);
          }
          if (Array.isArray(data.typingUsers)) {
            setTypingUsers(data.typingUsers.filter((t: TypingUser) => t.userId !== currentUser?.uid));
          }

          if (typeof data.messageCount === 'number' && data.messageCount !== lastKnownCountRef.current) {
            fetchOnlineData();
          }
        }
      } catch {}
    };

    const interval = setInterval(pollOnlineDatabase, 1500);
    return () => clearInterval(interval);
  }, [currentUser]);

  // 3. Online Presence Heartbeat in Online Cloud Database
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
          if (data?.allUsers && Array.isArray(data.allUsers)) {
            setMembers(data.allUsers);
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
        if (data?.allUsers && Array.isArray(data.allUsers)) {
          setMembers(data.allUsers);
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

  // Broadcast typing status to online database
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

  // Send message directly to online cloud database
  const handleSendMessage = async (text: string) => {
    if (!currentUser) return;

    const trimmed = text.trim();
    if (!trimmed) return;

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
      console.error('Failed to send to online database:', err);
    }

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
    setMessages([]);
    setOnlineUsers([]);
    setMembers([]);
    setTypingUsers([]);
    setCurrentUser(null);
    lastKnownCountRef.current = 0;
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
        matchedCount={filteredMessages.length}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        onlineCount={Math.max(1, onlineUsers.length)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {!currentUser ? (
          /* Simple Instant Name Login Screen */
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <AuthModal onJoin={handleJoin} />
          </div>
        ) : (
          /* Live Chat Room Layout with Dedicated Left Sidebar */
          <>
            {/* Left Side: Real-Time User & Member List */}
            <UserSidebar
              currentUser={currentUser}
              members={members}
              typingUsers={typingUsers}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />

            {/* Right Side: Chat Feed & Composer */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="text-xs">Loading chat history from cloud...</span>
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
          </>
        )}
      </main>

      {/* Modals */}
      <ClearModal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        currentUser={currentUser}
        onCleared={() => {
          setMessages([]);
          lastKnownCountRef.current = 0;
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
