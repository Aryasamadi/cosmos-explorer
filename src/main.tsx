import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppStateProvider } from './app/AppStateProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element was not found.');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </ErrorBoundary>
  </StrictMode>,
);
