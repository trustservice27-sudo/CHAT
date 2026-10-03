import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatUser } from '../types';
import { 
  ArrowDown, 
  MessageSquareDashed, 
  Copy, 
  Check,
  CheckCheck,
  Calendar
} from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  currentUser: ChatUser | null;
  searchQuery: string;
  scrollTrigger?: number;
}

// Generate consistent avatar colors from string hash
function getAvatarGradient(str: string): string {
  const gradients = [
    'from-indigo-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function formatMessageTime(timestamp: ChatMessage['createdAt']): string {
  if (!timestamp) return 'Just now';
  let date: Date;
  if ('toDate' in timestamp && typeof (timestamp as any).toDate === 'function') {
    date = (timestamp as any).toDate();
  } else if ('seconds' in timestamp) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp as any);
  }

  if (isNaN(date.getTime())) return 'Just now';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDate(timestamp: ChatMessage['createdAt']): string {
  if (!timestamp) return 'Today';
  let date: Date;
  if ('toDate' in timestamp && typeof (timestamp as any).toDate === 'function') {
    date = (timestamp as any).toDate();
  } else if ('seconds' in timestamp) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp as any);
  }

  if (isNaN(date.getTime())) return 'Today';

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
  });
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  searchQuery,
  scrollTrigger,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    if (!showScrollBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showScrollBottom]);

  // Scroll to bottom when keyboard opens or input is focused
  useEffect(() => {
    if (scrollTrigger) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollTrigger]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 100);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  const copyToClipboard = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  let lastDate = '';

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4 shadow-inner">
          <MessageSquareDashed className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-300 mb-1">
          {searchQuery ? 'No matching messages' : 'No messages yet'}
        </h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          {searchQuery 
            ? `No messages matched "${searchQuery}". Try another keyword.` 
            : 'Be the first to say hello or send an emoji in this public chat room!'}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-6 space-y-3.5 max-w-4xl mx-auto w-full relative touch-pan-y"
    >
      {messages.map((msg, index) => {
        const isSelf = Boolean(
          currentUser && 
          (currentUser.uid === msg.userId || 
           (currentUser.displayName && msg.displayName && 
            currentUser.displayName.trim().toLowerCase() === msg.displayName.trim().toLowerCase()))
        );
        const msgDate = formatMessageDate(msg.createdAt);
        const showDateSeparator = msgDate !== lastDate;
        if (showDateSeparator) {
          lastDate = msgDate;
        }

        return (
          <React.Fragment key={msg.id || index}>
            {/* Date divider */}
            {showDateSeparator && (
              <div className="flex items-center justify-center my-4 sm:my-5">
                <div className="h-px bg-slate-800 flex-1 max-w-xs"></div>
                <div className="mx-3 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-400 flex items-center gap-1.5 shadow-sm">
                  <Calendar className="w-3 h-3 text-indigo-400" />
                  <span>{msgDate}</span>
                </div>
                <div className="h-px bg-slate-800 flex-1 max-w-xs"></div>
              </div>
            )}

            {/* Message Row: Left for other chat, Right for my chat */}
            <div className={`w-full flex ${isSelf ? 'justify-end' : 'justify-start'} animate-in fade-in duration-100`}>
              <div 
                className={`flex items-end sm:items-start gap-2 sm:gap-2.5 max-w-[88%] sm:max-w-[78%] group ${
                  isSelf ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                {msg.photoURL ? (
                  <img
                    src={msg.photoURL}
                    alt={msg.displayName}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 ring-2 ring-slate-800 mb-0.5"
                  />
                ) : (
                  <div 
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                      msg.userId || msg.displayName
                    )} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-md ring-2 ring-slate-800 mb-0.5`}
                  >
                    {(msg.displayName || 'U')[0].toUpperCase()}
                  </div>
                )}

                {/* Message Content Container */}
                <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} min-w-0`}>
                  {/* Meta header (Sender name, Timestamp) */}
                  <div className={`flex items-center gap-1.5 mb-1 px-1 text-xs ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`font-semibold ${isSelf ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {isSelf ? 'You' : msg.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>

                  {/* Bubble */}
                  <div className={`relative group/bubble flex items-center gap-1 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div
                      onClick={() => copyToClipboard(msg.id, msg.text)}
                      className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap select-text cursor-pointer transition-transform active:scale-[0.99] ${
                        isSelf
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-sm shadow-md shadow-indigo-950/40 text-left'
                          : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm shadow-md text-left'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(msg.id, msg.text)}
                      className={`opacity-0 group-hover/bubble:opacity-100 sm:opacity-0 focus:opacity-100 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-opacity shrink-0 ${
                        copiedId === msg.id ? '!opacity-100 text-emerald-400' : ''
                      }`}
                      title="Copy text"
                      aria-label="Copy text"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Delivery & Seen receipt for my messages */}
                  {isSelf && (() => {
                    const otherSeenUsers = (msg.seenBy || []).filter(
                      (u) => u.userId !== currentUser?.uid
                    );
                    const hasBeenSeen = otherSeenUsers.length > 0;

                    return (
                      <div className="flex items-center gap-1.5 mt-1 px-1 justify-end select-none">
                        {hasBeenSeen ? (
                          <div 
                            className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium animate-in fade-in"
                            title={`Seen by: ${otherSeenUsers.map((u) => u.displayName).join(', ')}`}
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-emerald-400/90 font-medium">Seen</span>
                            <div className="flex items-center -space-x-1 ml-0.5">
                              {otherSeenUsers.slice(0, 3).map((u) => (
                                <div
                                  key={u.userId}
                                  title={u.displayName}
                                  className={`w-4 h-4 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                                    u.userId || u.displayName
                                  )} text-white font-bold text-[7px] flex items-center justify-center ring-1 ring-slate-900 shadow-xs`}
                                >
                                  {(u.displayName || 'U')[0].toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <span className="text-[10px] text-emerald-300 font-medium truncate max-w-[100px]">
                              {otherSeenUsers.map((u) => u.displayName).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 text-[10px] text-indigo-300/70" title="Message sent">
                            <Check className="w-3 h-3 text-indigo-300/70" />
                            <span>Sent</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <div ref={bottomRef} className="h-2" />

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-20 right-4 sm:right-6 p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-90 text-white shadow-xl shadow-indigo-600/40 border border-indigo-400/30 transition-all z-20 flex items-center justify-center animate-in fade-in"
          title="Scroll to latest messages"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
