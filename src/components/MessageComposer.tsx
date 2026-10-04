import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import type { ChatUser } from '../types';

interface MessageComposerProps {
  currentUser: ChatUser | null;
  onSendMessage: (text: string) => Promise<void> | void;
  onFocusInput?: () => void;
  onTyping?: (isTyping: boolean, text?: string) => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  currentUser,
  onSendMessage,
  onFocusInput,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false, '');
    };
  }, [onTyping]);

  // Auto-resize textarea smoothly based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Handle typing activity detection
  const notifyTyping = useCallback((newText: string) => {
    if (!currentUser) return;

    if (newText.trim().length > 0) {
      onTyping?.(true, newText);

      // Debounce: reset typing status after 2.5 seconds of inactivity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false, '');
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false, '');
    }
  }, [currentUser, onTyping]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !currentUser) return;

    if (trimmed.length > 2000) {
      setError('Message exceeds the 2,000 character maximum.');
      return;
    }

    // Immediately clear input for smooth, instant response
    setText('');
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Keep mobile keyboard open for regular continuous typing
      textareaRef.current.focus();
    }

    // Clear typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping?.(false);

    // Trigger non-blocking send in background with optimistic UI
    try {
      const res = onSendMessage(trimmed);
      if (res && typeof res.catch === 'function') {
        res.catch((err: any) => {
          const errMsg = err?.message || '';
          if (
            !errMsg.toLowerCase().includes('quota') &&
            !errMsg.toLowerCase().includes('resource_exhausted')
          ) {
            setError(errMsg || 'Failed to send message.');
          }
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (
        !errMsg.toLowerCase().includes('quota') &&
        !errMsg.toLowerCase().includes('resource_exhausted')
      ) {
        setError(errMsg || 'Failed to send message.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter creates a new line
    // Mobile: Regular keyboard Enter creates new line, user taps Send button
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > 2000;
  const canSend = Boolean(currentUser && text.trim() && !isOverLimit);

  return (
    <div className="p-2 sm:p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 relative z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        
        {/* Error notification */}
        {error && (
          <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 truncate">{error}</span>
          </div>
        )}

        {/* Regular Mobile & Desktop Composer Form */}
        <form 
          onSubmit={handleSubmit} 
          className="flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all shadow-inner"
        >
          {/* Regular standard textarea for natural mobile keyboard usage */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              notifyTyping(val);
            }}
            onFocus={() => onFocusInput?.()}
            onKeyDown={handleKeyDown}
            autoComplete="on"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck={true}
            placeholder={currentUser ? "Type a message..." : "Please set your name to chat"}
            disabled={!currentUser}
            maxLength={2000}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-base sm:text-sm py-2 px-2.5 focus:outline-none resize-none max-h-32 leading-relaxed font-sans"
          />

          <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-0.5">
            {/* Character count on large inputs */}
            {charCount > 1700 && (
              <span className={`text-[10px] font-mono tabular-nums ${
                isOverLimit ? 'text-rose-400 font-bold' : 'text-amber-400'
              }`}>
                {charCount}/2000
              </span>
            )}

            {/* Fast, reliable Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all select-none ${
                canSend
                  ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
