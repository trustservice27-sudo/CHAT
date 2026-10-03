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
  serverTimestamp, 
  handleFirestoreError, 
  OperationType
} from './firebase';
import type { ChatMessage, ChatUser } from './types';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { AuthModal } from './components/AuthModal';
import { ClearModal } from './components/ClearModal';
import { InfoModal } from './components/InfoModal';
import { playNotificationSound } from './utils/sound';
import { Loader2, AlertCircle } from 'lucide-react';

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

  // 1. Data Fetching (Live real-time public message subscription)
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
        setFirestoreError(error.message || 'Could not fetch live messages.');
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser, soundEnabled]);

  // Join handler (simple name login)
  const handleJoin = (user: ChatUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('openchat_user', JSON.stringify(user));
      localStorage.setItem('openchat_uid', user.uid);
    } catch {
      // Ignore localStorage exceptions in private browsing
    }
  };

  // Leave room / Switch name handler
  const handleSignOut = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('openchat_user');
    } catch {
      // Ignore
    }
  };

  // Send message
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {!currentUser ? (
          /* Simple Name Login Screen */
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
                <span className="text-xs">Loading live conversation...</span>
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
