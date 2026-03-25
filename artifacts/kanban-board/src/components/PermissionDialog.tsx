import React, { useState } from 'react';
import { AlertTriangle, Key, ChevronRight, X } from 'lucide-react';

interface PermissionDialogProps {
  open: boolean;
  owner: string;
  repo: string;
  fromCol: string;
  toCol: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const COL_LABELS: Record<string, string> = {
  todo: '待处理',
  'in-progress': '进行中',
  done: '已关闭',
};

export function PermissionDialog({
  open,
  owner,
  repo,
  fromCol,
  toCol,
  onConfirm,
  onCancel,
}: PermissionDialogProps) {
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'info' | 'token'>('info');

  if (!open) return null;

  const handleConfirmWithoutWrite = () => {
    // Allow local-only re-arrangement (board state saved, no GitHub write)
    onConfirm();
  };

  const handleVerifyToken = async () => {
    if (!token.trim()) return;
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!res.ok) {
        setError('Token is invalid or you do not have access to this repository.');
        setChecking(false);
        return;
      }

      const data = await res.json();
      const perms = data.permissions;
      const canWrite = perms?.push || perms?.admin || false;

      if (!canWrite) {
        setError('This token does not have write access to the repository.');
        setChecking(false);
        return;
      }

      // Store token in session for future use
      sessionStorage.setItem(`gh_token_${owner}_${repo}`, token.trim());
      setChecking(false);
      onConfirm();
    } catch {
      setError('Network error. Please try again.');
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-sm bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">移动 Issue</h3>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {COL_LABELS[fromCol]} → {COL_LABELS[toCol]}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {mode === 'info' ? (
            <>
              <p className="text-xs text-zinc-400 leading-relaxed">
                将 issue 移动到其他列将更新看板中的本地排列。
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                若要同时在 GitHub 上更改 issue 的状态或标签，需要提供有写入权限的 Personal Access Token。
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => setMode('token')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-sm bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                    <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200">提供 GitHub Token（同步至 GitHub）</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
                </button>

                <button
                  onClick={handleConfirmWithoutWrite}
                  className="w-full px-3 py-2.5 rounded-sm bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors text-left"
                >
                  仅在本地移动（不修改 GitHub）
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-400 leading-relaxed">
                输入 GitHub Personal Access Token（需要 <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded-sm font-mono text-[10px]">repo</code> 权限）
              </p>

              <div className="space-y-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-sm px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-500 transition-colors"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyToken(); }}
                  autoFocus
                />
                {error && (
                  <p className="text-[10px] font-mono text-red-500">{error}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleVerifyToken}
                  disabled={!token.trim() || checking}
                  className="flex-1 px-3 py-2 rounded-sm bg-zinc-100 text-zinc-900 text-xs font-mono font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {checking ? '验证中...' : '验证并移动'}
                </button>
                <button
                  onClick={() => { setMode('info'); setError(null); setToken(''); }}
                  className="px-3 py-2 rounded-sm border border-zinc-700 text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
                >
                  返回
                </button>
              </div>

              <p className="text-[10px] text-zinc-700 font-mono">
                Token 仅在本次会话中保存，不会上传至服务器。
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 text-zinc-500 hover:text-zinc-300 underline"
                >
                  创建 Token →
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
