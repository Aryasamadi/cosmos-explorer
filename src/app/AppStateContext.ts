import { createContext, useContext, type Dispatch } from 'react';
import type { AppAction, AppState } from './appState';

export interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider.');
  }
  return context.state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppDispatch must be used inside AppStateProvider.');
  }
  return context.dispatch;
}
