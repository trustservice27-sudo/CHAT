import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatUser } from '../types';
import { 
  ArrowDown, 
  MessageSquareDashed, 
  Copy, 
  Check,
  Calendar
} from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  currentUser: ChatUser | null;
  searchQuery: string;
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

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 150);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Group messages by date
  let lastDate = '';

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-4 shadow-xl">
          <MessageSquareDashed className="w-8 h-8 text-indigo-400/80" />
        </div>
        <h3 className="text-lg font-semibold text-slate-200">
          {searchQuery ? 'No matching messages found' : 'The Public Room is Clear'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          {searchQuery 
            ? `No messages matched "${searchQuery}". Try a different keyword.` 
            : 'Be the first verified member to send a message in this live group chat!'}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-4xl mx-auto w-full relative"
    >
      {messages.map((msg, index) => {
        const isSelf = currentUser?.uid === msg.userId;
        const msgDate = formatMessageDate(msg.createdAt);
        const showDateSeparator = msgDate !== lastDate;
        if (showDateSeparator) {
          lastDate = msgDate;
        }

        return (
          <React.Fragment key={msg.id || index}>
            {/* Date divider */}
            {showDateSeparator && (
              <div className="flex items-center justify-center my-5">
                <div className="h-px bg-slate-800 flex-1 max-w-xs"></div>
                <div className="mx-3 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-slate-400 flex items-center gap-1.5 shadow-sm">
                  <Calendar className="w-3 h-3 text-indigo-400" />
                  <span>{msgDate}</span>
                </div>
                <div className="h-px bg-slate-800 flex-1 max-w-xs"></div>
              </div>
            )}

            {/* Message Item */}
            <div 
              className={`flex items-start gap-2.5 sm:gap-3 group ${
                isSelf ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              {msg.photoURL ? (
                <img
                  src={msg.photoURL}
                  alt={msg.displayName}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-800"
                />
              ) : (
                <div 
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                    msg.userId || msg.displayName
                  )} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-md ring-2 ring-slate-800`}
                >
                  {(msg.displayName || 'U')[0].toUpperCase()}
                </div>
              )}

              {/* Message Content Container */}
              <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isSelf ? 'items-end' : 'items-start'}`}>
                {/* Meta header (Sender name, Timestamp) */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-xs">
                  <span className={`font-semibold ${isSelf ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {isSelf ? 'You' : msg.displayName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                {/* Bubble */}
                <div className="relative group/bubble">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      isSelf
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-md shadow-indigo-950/40'
                        : 'bg-slate-800 border border-slate-700/70 text-slate-100 rounded-tl-none shadow-md'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Copy message button */}
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.text)}
                    className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-md ${
                      isSelf ? '-left-8' : '-right-8'
                    }`}
                    title="Copy message"
                    aria-label="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <div ref={bottomRef} />

      {/* Floating Scroll to Bottom button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 z-20 p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-950/50 border border-indigo-400/30 transition-all hover:scale-110 active:scale-95 flex items-center justify-center animate-bounce"
          title="Scroll to latest messages"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
