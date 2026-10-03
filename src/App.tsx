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
  doc,
  serverTimestamp, 
  handleFirestoreError, 
  OperationType
} from './firebase';
import type { ChatMessage, ChatUser, OnlineUser } from './types';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
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
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Audio trigger tracking
  const initialLoadDone = useRef(false);
  const prevMessagesCount = useRef(0);

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
    setCurrentUser(null);
    try {
      localStorage.removeItem('openchat_user');
    } catch {
      // Ignore
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
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
        <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 shrink-0 uppercase tracking-wider mr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online Database Members ({onlineUsers.length}):
            </span>
            <div className="flex items-center -space-x-1.5 shrink-0">
              {onlineUsers.slice(0, 10).map((u) => (
                <div 
                  key={u.userId}
                  title={`${u.displayName} (Synced in online database)`}
                  className="w-6 h-6 rounded-full bg-indigo-600/80 border border-slate-700 text-white font-bold text-[10px] flex items-center justify-center ring-1 ring-slate-900 hover:scale-125 transition-transform hover:z-10"
                >
                  {(u.displayName || 'M')[0].toUpperCase()}
                </div>
              ))}
            </div>
            {onlineUsers.length > 10 && (
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">
                +{onlineUsers.length - 10} more
              </span>
            )}
          </div>
          <span className="text-[10px] text-indigo-400 font-mono hidden md:inline-flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3" />
            Cloud Firestore Synced
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {!currentUser ? (
          /* Simple Instant Name Login Screen */
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <AuthModal onJoin={handleJoin} />
          </div>
        ) : (
          /* Live Chat Room */
          <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
            
            {firestoreError && (
              <div className="max-w-4xl mx-auto w-full px-4 pt-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{firestoreError}</span>
                </div>
              </div>
            )}

            {messagesLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Loading live conversation from online database...</span>
              </div>
            ) : (
              <MessageList
                messages={filteredMessages}
                currentUser={currentUser}
                searchQuery={searchQuery}
              />
            )}

            {/* Message input bar */}
            <MessageComposer
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
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
