import { useAppDispatch, useAppState } from '../app/AppStateContext';
import { IconCompass, IconGlobe } from './Icons';

export function ModeSwitch() {
  const { mode } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="mode-switch" role="group" aria-label="حالت نمایش">
      <button
        type="button"
        className={`mode-switch__button ${mode === 'free' ? 'is-active' : ''}`}
        aria-pressed={mode === 'free'}
        onClick={() => dispatch({ type: 'set-mode', mode: 'free' })}
      >
        <IconGlobe size={15} />
        <span>کاوش آزاد</span>
      </button>
      <button
        type="button"
        className={`mode-switch__button ${mode === 'sky' ? 'is-active' : ''}`}
        aria-pressed={mode === 'sky'}
        onClick={() => dispatch({ type: 'set-mode', mode: 'sky' })}
      >
        <IconCompass size={15} />
        <span>آسمان واقعی</span>
      </button>
    </div>
  );
}
