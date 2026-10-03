import React, { useState } from 'react';
import { User, ArrowRight, MessageSquare } from 'lucide-react';
import type { ChatUser } from '../types';

interface AuthModalProps {
  onJoin: (user: ChatUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to join.');
      return;
    }
    if (trimmed.length > 50) {
      setError('Name must be 50 characters or fewer.');
      return;
    }

    // Persist or retrieve unique UID for this user
    let existingUid = '';
    try {
      existingUid = localStorage.getItem('openchat_uid') || '';
      if (!existingUid) {
        existingUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('openchat_uid', existingUid);
      }
    } catch {
      existingUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const user: ChatUser = {
      uid: existingUid,
      displayName: trimmed,
    };

    onJoin(user);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="text-center mb-6 relative">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
          <MessageSquare className="w-7 h-7" />
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">
          Join OpenChat
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
          Public group chat with online database sync. Enter your name to join instantly.
        </p>
      </div>

      {/* Simple Name Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Your Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your name (e.g. Alex)"
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center animate-in fade-in">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2"
        >
          <span>Join Chat</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
