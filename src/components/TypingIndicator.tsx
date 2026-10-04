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

  // Format typing header text
  let headerText = '';
  if (typingUsers.length === 1) {
    headerText = `${typingUsers[0].displayName} is typing...`;
  } else if (typingUsers.length === 2) {
    headerText = `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
  } else {
    headerText = `${typingUsers[0].displayName}, ${typingUsers[1].displayName} and ${typingUsers.length - 2} others are typing...`;
  }

  const singleTyper = typingUsers.length === 1 ? typingUsers[0] : null;

  return (
    <div className="w-full flex justify-start px-3 sm:px-6 py-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
      <div className="flex items-center gap-2 max-w-[90%] sm:max-w-[80%]">
        
        {/* User avatars */}
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

        {/* Typing Bubble with Real Typing Text */}
        <div className="flex flex-col gap-0.5 px-3 py-1.5 rounded-2xl rounded-tl-sm bg-slate-900 border border-indigo-500/30 text-slate-300 shadow-md">
          <div className="flex items-center gap-2">
            {/* Animated 3-dots */}
            <div className="flex items-center gap-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.32s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.16s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
            </div>

            {/* Header */}
            <span className="text-xs text-indigo-300 font-semibold truncate max-w-xs">
              {headerText}
            </span>
          </div>

          {/* Real Typing Message Text Preview */}
          {singleTyper && singleTyper.text && singleTyper.text.trim().length > 0 && (
            <div className="pl-5 text-xs text-slate-200 font-medium italic break-all flex items-center gap-1">
              <span>&ldquo;{singleTyper.text}&rdquo;</span>
              <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
