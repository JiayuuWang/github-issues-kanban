import React, { useState, useRef } from 'react';
import { X, Github, ExternalLink, Loader2, CheckCircle, AlertCircle, Key } from 'lucide-react';

interface GitHubAuthModalProps {
  onClose: () => void;
  onLogin: (token: string) => Promise<boolean>;
  isValidating: boolean;
  error: string | null;
}

export function GitHubAuthModal({ onClose, onLogin, isValidating, error }: GitHubAuthModalProps) {
  const [token, setToken] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    const ok = await onLogin(token.trim());
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Github className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-mono font-medium text-zinc-200">Connect GitHub Account</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-xs font-mono text-zinc-500 mb-5 leading-relaxed">
            Connect your GitHub account with a Personal Access Token to unlock write mode for your own repositories,
            increase API rate limits, and quickly switch between your repos.
          </p>

          {/* Steps to get token */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4 mb-5 space-y-2.5">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">How to get a token</p>
            {[
              { step: '1', text: 'Go to GitHub → Settings → Developer settings' },
              { step: '2', text: 'Click Personal access tokens → Tokens (classic)' },
              { step: '3', text: 'Generate new token → select "repo" scope' },
              { step: '4', text: 'Copy the token (starts with ghp_)' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2.5">
                <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded-sm bg-zinc-800 text-[9px] font-mono text-zinc-400">
                  {step}
                </span>
                <span className="text-[11px] font-mono text-zinc-500">{text}</span>
              </div>
            ))}
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=kanban-board"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open GitHub token creation page
            </a>
          </div>

          {/* Token input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
              <input
                ref={inputRef}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-zinc-500 rounded-sm pl-8 pr-4 py-2.5 text-xs font-mono text-zinc-200 placeholder-zinc-700 outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-red-400 bg-red-950/30 border border-red-900/50 rounded-sm px-3 py-2">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-sm border border-zinc-700 text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 bg-transparent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!token.trim() || isValidating}
                className="flex-1 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Validating…</>
                ) : (
                  <><CheckCircle className="w-3 h-3" /> Connect</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-zinc-800">
          <p className="text-[10px] font-mono text-zinc-700">
            Token stored locally in your browser only. Never sent to third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
