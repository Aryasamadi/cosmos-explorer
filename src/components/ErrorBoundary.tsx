import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconWarning } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled application error', error, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fatal-screen" role="alert">
          <div className="scene-fallback glass">
            <span className="scene-fallback__icon">
              <IconWarning size={34} />
            </span>
            <h1>برنامه با خطای غیرمنتظره متوقف شد</h1>
            <p>
              بخشی از رابط کاربری یا صحنهٔ سه‌بعدی با مشکل روبه‌رو شد. صفحه را دوباره بارگذاری
              کنید. اگر مشکل ادامه داشت، مرورگر دیگری را امتحان کنید.
            </p>
            <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
              بارگذاری دوباره
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
