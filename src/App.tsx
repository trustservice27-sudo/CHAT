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
import { useVisualViewport } from './utils/useVisualViewport';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const { viewportHeight, isKeyboardVisible } = useVisualViewport();

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

  // Auto-scroll when keyboard opens on mobile
  useEffect(() => {
    if (isKeyboardVisible) {
      setScrollTrigger((prev) => prev + 1);
    }
  }, [isKeyboardVisible]);

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
        setFirestoreError(error.message || 'Could not fetch live messages from online database.');
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser, soundEnabled]);

  // Mark other users' messages as seen by current user in real-time
  useEffect(() => {
    if (!currentUser || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) =>
        m.userId &&
        m.userId !== currentUser.uid &&
        (!m.readBy || !m.readBy.includes(currentUser.uid))
    );

    if (unreadMessages.length === 0) return;

    unreadMessages.forEach((msg) => {
      updateDoc(doc(db, 'messages', msg.id), {
        readBy: arrayUnion(currentUser.uid),
        seenBy: arrayUnion({
          userId: currentUser.uid,
          displayName: currentUser.displayName,
          seenAt: Date.now(),
        }),
      }).catch((err) => {
        console.warn('Failed to mark message as seen:', err);
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

        // Auto-scroll when someone starts typing if user was near bottom
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
      // Ignore localStorage exceptions in private browsing
    }

    // Save user profile into ONLINE DATABASE (Firestore)
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
    } catch {
      // Ignore
    }
  };

  // Broadcast typing status to Firestore
  const handleTyping = async (isTyping: boolean) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'typing', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping,
        timestamp: Date.now(),
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to update typing status:', err);
    }
  };

  // Send message directly to ONLINE DATABASE
  const handleSendMessage = async (text: string) => {
    if (!currentUser) return;

    const path = 'messages';
    const payload = {
      userId: currentUser.uid,
      displayName: currentUser.displayName,
      text: text.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, path), payload);

      // Clear typing status immediately
      setDoc(doc(db, 'typing', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        isTyping: false,
        timestamp: Date.now(),
      }, { merge: true }).catch(() => {});

      // Refresh lastActive in online database
      setDoc(doc(db, 'users', currentUser.uid), {
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        lastActive: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
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
    <div 
      style={{ height: viewportHeight ? `${viewportHeight}px` : undefined }}
      className="h-dvh max-h-dvh w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 fixed inset-0"
    >
      
      {/* Top Header (shrink-0 fixed at top) */}
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

      {/* Online Database Active Users Bar (shrink-0) */}
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

      {/* Main Content Area (flex-1 min-h-0) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {!currentUser ? (
          /* Simple Instant Name Login Screen */
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <AuthModal onJoin={handleJoin} />
          </div>
        ) : (
          /* Live Chat Room Layout */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            
            {firestoreError && (
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

            {/* Real-time Typing Indicator (placed right above composer) */}
            <TypingIndicator typingUsers={typingUsers} />

            {/* Message input bar (shrink-0 fixed at bottom) */}
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
      />

      <InfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
      />

    </div>
  );
}
