import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  Server,
  UserX,
  MessageSquareX,
  RotateCcw
} from 'lucide-react';
import { db, collection, getDocs, writeBatch } from '../firebase';
import type { ChatUser } from '../types';

interface ClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: ChatUser | null;
  onCleared: () => void;
  onResetAll?: () => void;
}

type ClearMode = 'messages_only' | 'everything_and_new_user';

export const ClearModal: React.FC<ClearModalProps> = ({
  isOpen,
  onClose,
  onCleared,
  onResetAll,
}) => {
  const [mode, setMode] = useState<ClearMode>('everything_and_new_user');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClear = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = password.trim();
    if (!entered) {
      setError('Please enter the secret passcode.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Clear Central Online Database via server API
      const res = await fetch('/api/clear-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entered })
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Incorrect passcode. Access denied.');
      }

      // 2. Also clear Firestore Cloud collections in background (with safe error handling for quota limits)
      try {
        const messagesSnap = await getDocs(collection(db, 'messages'));
        if (!messagesSnap.empty) {
          const batch = writeBatch(db);
          messagesSnap.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      } catch (fsErr) {
        console.warn('Firestore online collection clear note:', fsErr);
      }

      // 3. If "Clear Everything & Start as New User" is selected:
      if (mode === 'everything_and_new_user') {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const userBatch = writeBatch(db);
            usersSnap.docs.forEach((docSnap) => {
              userBatch.delete(docSnap.ref);
            });
            await userBatch.commit();
          }
        } catch (fsErr) {
          console.warn('Firestore users collection clear note:', fsErr);
        }

        try {
          const typingSnap = await getDocs(collection(db, 'typing'));
          if (!typingSnap.empty) {
            const typingBatch = writeBatch(db);
            typingSnap.docs.forEach((docSnap) => {
              typingBatch.delete(docSnap.ref);
            });
            await typingBatch.commit();
          }
        } catch (fsErr) {
          console.warn('Firestore typing collection clear note:', fsErr);
        }

        // Clear user session
        try {
          localStorage.removeItem('openchat_user');
          localStorage.removeItem('openchat_uid');
        } catch {
          // Ignore
        }
      }

      setSuccess(true);
      setTimeout(() => {
        if (mode === 'everything_and_new_user') {
          onResetAll?.();
        } else {
          onCleared();
        }
        onClose();
        setPassword('');
        setSuccess(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Incorrect security code or operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Clear & Reset Options
            </h3>
            <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
              <Server className="w-3 h-3" /> Security Protected
            </span>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 gap-2 mb-4">
          <label 
            onClick={() => setMode('everything_and_new_user')}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
              mode === 'everything_and_new_user'
                ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-md shadow-rose-950/30'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input 
              type="radio" 
              name="clear_mode" 
              checked={mode === 'everything_and_new_user'} 
              onChange={() => setMode('everything_and_new_user')}
              className="mt-1 accent-rose-500"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-1.5 text-slate-100">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                Clear Everything & Make a New User
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Wipes all messages, resets users and online sessions, and resets your profile to join fresh as a new user.
              </p>
            </div>
          </label>

          <label 
            onClick={() => setMode('messages_only')}
            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
              mode === 'messages_only'
                ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-md shadow-rose-950/30'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input 
              type="radio" 
              name="clear_mode" 
              checked={mode === 'messages_only'} 
              onChange={() => setMode('messages_only')}
              className="mt-1 accent-rose-500"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-1.5 text-slate-100">
                <MessageSquareX className="w-4 h-4 text-rose-400" />
                Clear Messages Only
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Deletes all chat messages, keeping your current name and active session.
              </p>
            </div>
          </label>
        </div>

        {/* Form */}
        <form onSubmit={handleClear} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Security Passcode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secret passcode..."
                disabled={loading || success}
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                tabIndex={-1}
                aria-label={showPassword ? "Hide input" : "Show input"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {mode === 'everything_and_new_user'
                  ? 'All data cleared! Resetting as a new user...'
                  : 'All messages have been successfully cleared.'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !password.trim()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-lg shadow-rose-900/30 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {mode === 'everything_and_new_user' ? 'Clear Everything' : 'Clear Messages'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
