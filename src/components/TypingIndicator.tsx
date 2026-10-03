import React from 'react';
import type { TypingUser } from '../types';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

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

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  // Format typing text
  let text = '';
  if (typingUsers.length === 1) {
    text = `${typingUsers[0].displayName} is typing...`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
  } else {
    text = `${typingUsers[0].displayName}, ${typingUsers[1].displayName} and ${typingUsers.length - 2} others are typing...`;
  }

  return (
    <div className="w-full flex justify-start px-3 sm:px-6 py-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
      <div className="flex items-center gap-2 max-w-[85%] sm:max-w-[75%]">
        
        {/* User name symbols / avatars */}
        <div className="flex items-center -space-x-1.5 shrink-0">
          {typingUsers.map((u) => (
            <div
              key={u.userId}
              title={`${u.displayName} is typing`}
              className={`w-6 h-6 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                u.userId || u.displayName
              )} text-white font-bold flex items-center justify-center text-[10px] ring-2 ring-slate-900 shadow-sm animate-pulse`}
            >
              {(u.displayName || 'U')[0].toUpperCase()}
            </div>
          ))}
        </div>

        {/* Typing Bubble */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 text-slate-300 shadow-sm">
          {/* Animated 3-dots */}
          <div className="flex items-center gap-1 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.32s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.16s]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
          </div>

          {/* Typing Description */}
          <span className="text-xs text-slate-400 font-medium italic truncate max-w-xs">
            {text}
          </span>
        </div>
      </div>
    </div>
  );
};
