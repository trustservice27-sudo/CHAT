import React from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Terminal, 
  Users, 
  Server,
  FileCode2
} from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                OpenChat Architecture & Security
              </h3>
              <p className="text-xs text-slate-400">
                Real-time synchronized public group chat with protected admin access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm text-slate-300">
          
          {/* Key Principles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1 text-xs uppercase tracking-wider">
                <Users className="w-4 h-4" />
                Community Members
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Registered members can read and post messages directly to the live public room.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1 text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                No Client Deletions
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clients cannot edit or delete messages directly, ensuring chat integrity.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2 text-rose-400 font-semibold mb-1 text-xs uppercase tracking-wider">
                <Server className="w-4 h-4" />
                Server CLEAR Secret
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The CLEAR action requires a password validated strictly on the server side, protecting against unauthorized wipes.
              </p>
            </div>
          </div>

          {/* Real-time Architecture */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-indigo-400" />
              Real-Time Synchronization
            </h4>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
              <pre>{`// High-performance live event streaming
1. Instant optimistic local rendering
2. Real-time broadcast to all connected devices worldwide
3. Live presence heartbeat and active typing indicators`}</pre>
            </div>
          </div>

          {/* Quick Setup Checklist */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Server Secret Configuration
            </h4>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5">
              <p className="text-slate-400"># Passcode for the Clear action:</p>
              <p className="text-cyan-300">ADMIN</p>
              <p className="text-slate-400"># Or customize CLEAR_PASSWORD in your environment variables</p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-100 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
