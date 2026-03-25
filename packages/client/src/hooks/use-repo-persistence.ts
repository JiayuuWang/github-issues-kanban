import { useState, useEffect } from 'react';

const REPO_STORAGE_KEY = 'kanban_selected_repo';
const DEFAULT_REPO = 'facebook/react';

export function useRepoPersistence() {
  const [repoStr, setRepoStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(REPO_STORAGE_KEY);
      return saved || DEFAULT_REPO;
    } catch {
      return DEFAULT_REPO;
    }
  });

  const setAndSaveRepo = (newRepo: string) => {
    setRepoStr(newRepo);
    try {
      localStorage.setItem(REPO_STORAGE_KEY, newRepo);
    } catch (e) {
      console.error('Failed to save repo to localStorage', e);
    }
  };

  const parsed = repoStr.split('/');
  const owner = parsed[0] || '';
  const repo = parsed[1] || '';
  const isValid = owner.length > 0 && repo.length > 0;

  return { 
    repoStr, 
    setRepoStr: setAndSaveRepo, 
    owner, 
    repo,
    isValid 
  };
}
