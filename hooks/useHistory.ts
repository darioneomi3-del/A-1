import { useState, useCallback } from 'react';

export default function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);

  const currentState = history[index];

  const pushState = useCallback((newState: T) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, index + 1);
      newHistory.push(newState);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex > 50 ? 50 : nextIndex;
    });
  }, [index]);

  const undo = useCallback(() => {
    setIndex(prev => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setIndex(prev => Math.min(history.length - 1, prev + 1));
  }, [history.length]);

  return {
    state: currentState,
    pushState,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    historyIndex: index
  };
}