import { getBodyById } from '../catalog/bodies';
import type { GeoLocation } from '../geo/types';

export type AppMode = 'free' | 'sky';

export interface AppState {
  mode: AppMode;
  /** Selection is kept per mode so a mode round trip does not lose context. */
  freeSelectedBodyId: string | null;
  skySelectedBodyId: string | null;
  infoOpen: boolean;
  lowPower: boolean;
  /** User-selected observer location, shared by Earth and Sky for this session. */
  location: GeoLocation | null;
}

export type AppAction =
  | { type: 'set-mode'; mode: AppMode }
  | { type: 'select-body'; bodyId: string }
  | { type: 'toggle-info' }
  | { type: 'close-info' }
  | { type: 'set-low-power'; enabled: boolean }
  | { type: 'set-location'; location: GeoLocation }
  | { type: 'clear-location' };

export const initialAppState: AppState = {
  mode: 'free',
  freeSelectedBodyId: null,
  skySelectedBodyId: null,
  infoOpen: false,
  lowPower: false,
  location: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'set-mode': {
      if (action.mode === state.mode) return state;
      return { ...state, mode: action.mode, infoOpen: false };
    }
    case 'select-body': {
      if (!getBodyById(action.bodyId)) return state;
      return state.mode === 'free'
        ? { ...state, freeSelectedBodyId: action.bodyId, infoOpen: true }
        : { ...state, skySelectedBodyId: action.bodyId, infoOpen: true };
    }
    case 'toggle-info':
      return { ...state, infoOpen: !state.infoOpen };
    case 'close-info':
      return state.infoOpen ? { ...state, infoOpen: false } : state;
    case 'set-low-power':
      return state.lowPower === action.enabled
        ? state
        : { ...state, lowPower: action.enabled };
    case 'set-location':
      return { ...state, location: action.location };
    case 'clear-location':
      return state.location === null ? state : { ...state, location: null };
    default:
      return state;
  }
}
