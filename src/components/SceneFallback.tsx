import { IconWarning } from './Icons';

interface SceneFallbackProps {
  title: string;
  message: string;
  onRetry?: () => void;
  extra?: string;
}

export function SceneFallback({ title, message, onRetry, extra }: SceneFallbackProps) {
  return (
    <div className="scene-fallback glass" role="alert">
      <span className="scene-fallback__icon">
        <IconWarning size={30} />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {extra ? <p className="scene-fallback__extra">{extra}</p> : null}
      {onRetry ? (
        <button type="button" className="button button--primary" onClick={onRetry}>
          تلاش دوباره
        </button>
      ) : null}
    </div>
  );
}
