import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  AlertCircle, 
  Loader2,
  Smile
} from 'lucide-react';
import type { ChatUser } from '../types';
import { EmojiPicker } from './EmojiPicker';

interface MessageComposerProps {
  currentUser: ChatUser | null;
  onSendMessage: (text: string) => Promise<void>;
  onFocusInput?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '💯', '👏', '🙏', '✨'];

export const MessageComposer: React.FC<MessageComposerProps> = ({
  currentUser,
  onSendMessage,
  onFocusInput,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showEmojiPicker]);

  // Clean up typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false);
    };
  }, [onTyping]);

  // Auto-resize textarea smoothly
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  // Handle typing activity detection
  const notifyTyping = useCallback((newText: string) => {
    if (!currentUser) return;

    if (newText.trim().length > 0) {
      onTyping?.(true);

      // Debounce: reset typing status after 2.5 seconds of inactivity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping?.(false);
    }
  }, [currentUser, onTyping]);

  // Insert emoji at the exact current cursor position or selection
  const handleInsertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const nextText = text + emoji;
      setText(nextText);
      notifyTyping(nextText);
      return;
    }

    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const updatedText = before + emoji + after;
    setText(updatedText);
    notifyTyping(updatedText);

    // Keep focus and position cursor right after the newly inserted emoji
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + emoji.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  }, [text, notifyTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (trimmed.length > 2000) {
      setError('Message exceeds the 2,000 character maximum.');
      return;
    }

    // Clear typing indicator immediately upon sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping?.(false);

    setSending(true);
    setError(null);
    setShowEmojiPicker(false);

    try {
      await onSendMessage(trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter only on non-mobile screens when Shift isn't pressed
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFocus = () => {
    setShowEmojiPicker(false);
    onFocusInput?.();
    
    // Ensure input container stays visible when mobile keyboard opens
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 120);
  };

  const charCount = text.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div 
      ref={containerRef}
      className="p-2 sm:p-4 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 relative z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-4xl mx-auto relative">
        
        {/* Error notification */}
        {error && (
          <div className="mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 truncate">{error}</span>
          </div>
        )}

        {/* Emoji Picker Popover / Drawer */}
        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onSelectEmoji={handleInsertEmoji}
        />

        {/* Quick Emoji Bar (Optimized for mobile touch targets) */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showEmojiPicker
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'bg-slate-800/90 hover:bg-slate-750 text-indigo-400 border-indigo-500/30 hover:border-indigo-400'
            }`}
            title="Open emoji drawer"
            aria-label="Open emoji picker"
          >
            <Smile className="w-4 h-4" />
            <span className="text-[11px]">Emojis</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0 mx-0.5"></div>

          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleInsertEmoji(emoji);
              }}
              onClick={(e) => {
                e.preventDefault();
                handleInsertEmoji(emoji);
              }}
              className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center text-base rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-90 active:bg-indigo-600/40 text-slate-200 transition-transform select-none cursor-pointer"
              title={`Add ${emoji}`}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Composer Form */}
        <form 
          onSubmit={handleSend} 
          className="relative flex items-end gap-1.5 sm:gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 sm:p-2 focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner"
        >
          {/* Emoji Toggle inside input on mobile */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="p-2 text-slate-400 hover:text-indigo-400 active:text-indigo-300 rounded-xl hover:bg-slate-900 transition-colors shrink-0"
            title="Emoji picker"
            aria-label="Toggle emoji picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Area (16px base font on mobile prevents auto-zoom in Safari, enterKeyHint="send") */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              notifyTyping(val);
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            enterKeyHint="send"
            placeholder={currentUser ? "Type a message or emoji..." : "Please set your name to chat"}
            disabled={!currentUser || sending}
            maxLength={2000}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-base sm:text-sm py-2 px-1 focus:outline-none resize-none max-h-36 leading-normal font-sans"
          />

          <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-0.5">
            {/* Character count on larger screens */}
            {charCount > 0 && (
              <span className={`text-[10px] sm:text-xs font-mono tabular-nums hidden sm:inline ${
                isOverLimit 
                  ? 'text-rose-400 font-bold' 
                  : isNearLimit 
                    ? 'text-amber-400' 
                    : 'text-slate-500'
              }`}>
                {charCount}/2000
              </span>
            )}

            {/* Send Button (Touch-optimized 40x40px minimum) */}
            <button
              type="submit"
              disabled={!currentUser || !text.trim() || sending || isOverLimit}
              className="w-10 h-10 sm:w-auto sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
              title="Send message"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="text-xs font-semibold hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
