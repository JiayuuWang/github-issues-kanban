import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface RepoFormProps {
  currentRepo: string;
  onSetRepo: (repo: string) => void;
  isLoading: boolean;
}

export function RepoForm({ currentRepo, onSetRepo, isLoading }: RepoFormProps) {
  const [value, setValue] = useState(currentRepo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = value.trim();
    if (clean && clean.includes('/')) {
      onSetRepo(clean);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-sm">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/repo"
          className="w-full h-7 pl-8 pr-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 rounded-sm text-xs font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !value.trim() || value.trim() === currentRepo}
        className="h-7 px-3 rounded-sm bg-zinc-200 hover:bg-white text-zinc-900 text-xs font-mono font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
      </button>
    </form>
  );
}
