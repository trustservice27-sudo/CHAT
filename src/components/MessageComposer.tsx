import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  AlertCircle, 
  Loader2
} from 'lucide-react';
import type { ChatUser } from '../types';

interface MessageComposerProps {
  currentUser: ChatUser | null;
  onSendMessage: (text: string) => Promise<void>;
}

const QUICK_EMOJIS = ['👍', '👋', '🎉', '🔥', '❤️', '🚀', '💯', '👏'];

export const MessageComposer: React.FC<MessageComposerProps> = ({
  currentUser,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (trimmed.length > 2000) {
      setError('Message exceeds the 2,000 character maximum.');
      return;
    }

    setSending(true);
    setError(null);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const charCount = text.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80">
      <div className="max-w-4xl mx-auto">
        
        {/* Error message */}
        {error && (
          <div className="mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-medium text-slate-500 px-1 hidden sm:inline">
            Quick:
          </span>
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleInsertEmoji(emoji)}
              className="text-sm px-2 py-0.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 transition-colors hover:scale-110 active:scale-95"
              title={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Composer Form */}
        <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentUser ? "Message #public-chat... (Enter to send, Shift+Enter for new line)" : "Please sign in to send messages"}
            disabled={!currentUser || sending}
            maxLength={2000}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm sm:text-base px-2 py-1.5 focus:outline-none resize-none max-h-40 leading-relaxed font-sans"
          />

          <div className="flex items-center gap-2 shrink-0 pb-1 pr-1">
            {/* Character count */}
            <span className={`text-[11px] font-mono tabular-nums ${
              isOverLimit 
                ? 'text-rose-400 font-bold' 
                : isNearLimit 
                  ? 'text-amber-400' 
                  : 'text-slate-500'
            }`}>
              {charCount > 0 && `${charCount}/2000`}
            </span>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!currentUser || !text.trim() || sending || isOverLimit}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
              title="Send message (Enter)"
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
