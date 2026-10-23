import { CORE_BODY_IDS, getBodyById } from '../catalog/bodies';
import type { GeoLocation } from '../geo/types';

export type AppMode = 'free' | 'sky';

export interface AppState {
  mode: AppMode;
  selectedBodyId: string;
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
  selectedBodyId: 'earth',
  infoOpen: false,
  lowPower: false,
  location: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'set-mode': {
      if (action.mode === state.mode) return state;
      const selected = getBodyById(state.selectedBodyId);
      const availableInMode =
        action.mode === 'sky'
          ? Boolean(selected?.skyVisible)
          : Boolean(
              selected &&
                CORE_BODY_IDS.includes(selected.id as (typeof CORE_BODY_IDS)[number]),
            );
      const selectedBodyId = availableInMode
        ? state.selectedBodyId
        : action.mode === 'sky'
          ? 'sun'
          : 'earth';
      return { ...state, mode: action.mode, selectedBodyId, infoOpen: false };
    }
    case 'select-body': {
      if (!getBodyById(action.bodyId)) return state;
      return { ...state, selectedBodyId: action.bodyId, infoOpen: true };
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
