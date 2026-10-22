import { useMemo, useReducer, type ReactNode } from 'react';
import { appReducer, initialAppState } from './appState';
import { AppStateContext } from './AppStateContext';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
