import React, { useState } from 'react';
import { Smile, Heart, ThumbsUp, Sparkles, X, Search } from 'lucide-react';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', 
      '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', 
      '😜', '🤪', '😎', '🤩', '🥳', '😏', '🤔', '🤫', '🤭', '🫢', 
      '🫡', '😴', '🤤', '🥶', '🥵', '🤯', '🥺', '😭', '😱', '😡', 
      '🤬', '💩', '🤡', '👻', '💀', '👽', '🤖'
    ],
  },
  {
    id: 'hands',
    name: 'Gestures',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', 
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', 
      '🤚', '🖐️', '🖖', '👋', '🫡', '💪', '👊', '✊', '🤛', '🤜'
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts & Love',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', 
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'
    ],
  },
  {
    id: 'vibes',
    name: 'Fun & Vibes',
    icon: Sparkles,
    emojis: [
      '🔥', '✨', '🌟', '💥', '💯', '🚀', '⚡', '🎉', '🎊', '🎈', 
      '🏆', '🥇', '🎯', '🎲', '🎮', '🎵', '🎶', '🍕', '🍔', '🍟', 
      '🍩', '☕', '🍻', '🥂', '🍿', '👀', '💡', '📌', '💬', '🌈'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const [activeTab, setActiveTab] = useState('smileys');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0];

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(search.trim()))
    : currentCategory.emojis;

  return (
    <div 
      className="absolute bottom-full left-0 right-0 sm:left-auto sm:right-4 mb-2 z-50 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl sm:w-80 max-w-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header & Tabs */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id && !search;
            return (
              <button
                key={cat.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setActiveTab(cat.id);
                  setSearch('');
                }}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{cat.name}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          title="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input for Mobile */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-56 sm:max-h-60 overflow-y-auto overscroll-contain grid grid-cols-7 sm:grid-cols-8 gap-1.5 place-items-center">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={(e) => {
              e.preventDefault();
              onSelectEmoji(emoji);
            }}
            onClick={(e) => {
              e.preventDefault();
              onSelectEmoji(emoji);
            }}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-xl sm:text-lg rounded-xl hover:bg-slate-800 active:scale-90 active:bg-indigo-600/30 transition-all select-none cursor-pointer"
            title={emoji}
            aria-label={`Insert emoji ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Quick Helper Bar */}
      <div className="px-3 py-2 bg-slate-950/50 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Tap any emoji to add to chat</span>
        <span className="text-indigo-400 font-mono text-[10px]">Emoji Ready</span>
      </div>
    </div>
  );
};
