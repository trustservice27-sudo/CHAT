/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  db, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc,
  arrayUnion,
  doc,
  serverTimestamp, 
  handleFirestoreError, 
  OperationType
} from './firebase';
import type { ChatMessage, ChatUser, OnlineUser, TypingUser } from './types';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { TypingIndicator } from './components/TypingIndicator';
import { AuthModal } from './components/AuthModal';
import { ClearModal } from './components/ClearModal';
import { InfoModal } from './components/InfoModal';
import { playNotificationSound } from './utils/sound';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(() => {
    try {
      const saved = localStorage.getItem('openchat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);

  // Audio trigger tracking
  const initialLoadDone = useRef(false);
  const prevMessagesCount = useRef(0);
  const markedSeenRef = useRef<Set<string>>(new Set());
  const isTypingActiveRef = useRef(false);

  // 1. Data Fetching (Live real-time messages from online database)
  useEffect(() => {
    setMessagesLoading(true);
    setFirestoreError(null);

    const path = 'messages';
    const messagesQuery = query(
      collection(db, path),
      orderBy('createdAt', 'asc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const loaded: ChatMessage[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId || '',
            displayName: data.displayName || 'Member',
            photoURL: data.photoURL,
            text: data.text || '',
            createdAt: data.createdAt || null,
            readBy: Array.isArray(data.readBy) ? data.readBy : [],
            seenBy: Array.isArray(data.seenBy) ? data.seenBy : [],
          };
        });

        // Trigger chime on new incoming message from someone else
        if (
          initialLoadDone.current &&
          loaded.length > prevMessagesCount.current &&
          soundEnabled
        ) {
          const latest = loaded[loaded.length - 1];
          if (latest && currentUser && latest.userId !== currentUser.uid) {
            playNotificationSound();
          }
        }

        prevMessagesCount.current = loaded.length;
        initialLoadDone.current = true;
        setMessages(loaded);
        setMessagesLoading(false);
      },
      (error) => {
        setMessagesLoading(false);
        const errMsg = error?.message || '';
        // Suppress quota exceeded and internal resource messages from UI
        if (
          !errMsg.toLowerCase().includes('quota') &&
          !errMsg.toLowerCase().includes('resource_exhausted')
        ) {
          setFirestoreError(errMsg);
        }
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser, soundEnabled]);

  // Mark only recent new messages as seen once per message without write loops
  useEffect(() => {
    if (!currentUser || messages.length === 0) return;

    // Check only the 5 most recent messages to keep Firestore fast and light
    const recent = messages.slice(-5);
    const unread = recent.filter(
      (m) =>
        m.userId &&
        m.userId !== currentUser.uid &&
        !markedSeenRef.current.has(m.id) &&
        (!m.readBy || !m.readBy.includes(currentUser.uid))
    );

    if (unread.length === 0) return;

    unread.forEach((msg) => {
      markedSeenRef.current.add(msg.id);
      updateDoc(doc(db, 'messages', msg.id), {
        readBy: arrayUnion(currentUser.uid),
        seenBy: arrayUnion({
          userId: currentUser.uid,
          displayName: currentUser.displayName,
          seenAt: Date.now(),
        }),
      }).catch(() => {
        // Silently catch to prevent disruption
      });
    });
  }, [messages, currentUser]);

  // 2. Data Fetching (Live real-time active users from online database)
  useEffect(() => {
    const usersPath = 'users';
    const usersQuery = query(
      collection(db, usersPath),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const users: OnlineUser[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            userId: docSnap.id,
            displayName: data.displayName || 'Member',
            lastActive: data.lastActive || null,
          };
        });
        setOnlineUsers(users);
      },
      (err) => {
        console.warn('Online users listener:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Real-time Typing Status Listener
  useEffect(() => {
    const typingQuery = query(collection(db, 'typing'));

    const unsubscribe = onSnapshot(
      typingQuery,
      (snapshot) => {
        const now = Date.now();
        const activeTypers: TypingUser[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          // Exclude self, require isTyping = true, and ignore stale events > 5s old
          if (
            data.isTyping &&
            data.userId !== currentUser?.uid &&
            data.displayName &&
            now - (data.timestamp || 0) < 5000
          ) {
            activeTypers.push({
              userId: data.userId || docSnap.id,
              displayName: data.displayName || 'Someone',
              isTyping: true,
              timestamp: data.timestamp || now,
            });
          }
        });

        setTypingUsers(activeTypers);

        if (activeTypers.length > 0) {
          setScrollTrigger((prev) => prev + 1);
        }
      },
      (err) => {
        console.warn('Typing status listener error:', err);
      }
    );

    // Periodic sweep to remove expired typing entries
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((t) => now - t.timestamp < 5000));
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  // Sync current user to online database on initial load if logged in
  useEffect(() => {
    if (currentUser) {
      setDoc(doc(db, 'users', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        lastActive: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
  }, [currentUser]);

  // Join handler (Persist in local storage & save in online database)
  const handleJoin = async (user: ChatUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('openchat_user', JSON.stringify(user));
      localStorage.setItem('openchat_uid', user.uid);
    } catch {
      // Ignore
    }

    try {
      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        displayName: user.displayName,
        lastActive: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to save user to online database', err);
    }
  };

  // Leave room handler
  const handleSignOut = () => {
    if (currentUser) {
      // Clean up typing status
      setDoc(doc(db, 'typing', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping: false,
        timestamp: Date.now(),
      }, { merge: true }).catch(() => {});
    }

    setCurrentUser(null);
    try {
      localStorage.removeItem('openchat_user');
      localStorage.removeItem('openchat_uid');
    } catch {
      // Ignore
    }
  };

  // Broadcast typing status to Firestore without redundant writes
  const handleTyping = async (isTyping: boolean) => {
    if (!currentUser || isTypingActiveRef.current === isTyping) return;
    isTypingActiveRef.current = isTyping;
    try {
      await setDoc(doc(db, 'typing', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping,
        timestamp: Date.now(),
      }, { merge: true });
    } catch {
      // Ignore
    }
  };

  // Send message directly to ONLINE DATABASE with instant optimistic update
  const handleSendMessage = async (text: string) => {
    if (!currentUser) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const path = 'messages';
    const payload = {
      userId: currentUser.uid,
      displayName: currentUser.displayName,
      text: trimmed,
      createdAt: serverTimestamp(),
      readBy: [currentUser.uid],
      seenBy: [{
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        seenAt: Date.now(),
      }],
    };

    // Optimistic message displayed immediately in chat (0ms lag)
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

    try {
      await addDoc(collection(db, path), payload);

      // Clear typing status immediately
      isTypingActiveRef.current = false;
      setDoc(doc(db, 'typing', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping: false,
        timestamp: Date.now(),
      }, { merge: true }).catch(() => {});
    } catch (error: any) {
      // Remove optimistic message if send failed
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  };

  // Reset Everything handler (clears state, signs out, returns to join screen)
  const handleResetEverything = () => {
    setMessages([]);
    setOnlineUsers([]);
    setTypingUsers([]);
    setCurrentUser(null);
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

      {/* Online Database Active Users Bar */}
      {currentUser && onlineUsers.length > 0 && (
        <div className="shrink-0 bg-slate-900/60 border-b border-slate-800/80 px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online ({onlineUsers.length}):
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
          <span className="text-[10px] text-indigo-400 font-mono hidden sm:inline-flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3" />
            Live Cloud
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
            
            {firestoreError && !firestoreError.toLowerCase().includes('quota') && (
              <div className="shrink-0 max-w-4xl mx-auto w-full px-3 pt-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{firestoreError}</span>
                </div>
              </div>
            )}

            {messagesLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Loading live conversation...</span>
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

            {/* Message input bar (clean, instant send, regular mobile keyboard) */}
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
          setMessages([]);
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
