import { useState } from 'react';
import { APP_NAME_EN, APP_NAME_FA } from '../config/app';
import { useAppDispatch, useAppState } from './AppStateContext';
import { ModeSwitch } from '../components/ModeSwitch';
import { IconGear, IconOrbit } from '../components/Icons';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { FreeExploreMode } from '../features/free-explore/FreeExploreMode';
import { SkyMode } from '../features/sky-view/SkyMode';

export function App() {
  const { mode, lowPower } = useAppState();
  const dispatch = useAppDispatch();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={`app app--${mode}`}>
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <h1 className="sr-only">کاوشگر کیهان</h1>
      <header className="app-header glass">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <IconOrbit size={22} />
          </span>
          <span className="brand__text">
            <span className="brand__title">{APP_NAME_FA}</span>
            <span className="brand__subtitle" dir="ltr">
              {APP_NAME_EN}
            </span>
          </span>
        </div>
        <ModeSwitch />
        <button
          type="button"
          className="icon-button app-header__settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="تنظیمات و منابع"
        >
          <IconGear size={20} />
        </button>
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        <FreeExploreMode active={mode === 'free'} />
        <SkyMode active={mode === 'sky'} />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lowPower={lowPower}
        onLowPowerChange={(enabled) =>
          dispatch({ type: 'set-low-power', enabled })
        }
      />
    </div>
  );
}
