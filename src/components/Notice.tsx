import type { ReactNode } from 'react';
import { IconCheck, IconClose, IconInfo, IconWarning } from './Icons';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
  role?: 'status' | 'alert';
}

const ICONS = {
  info: IconInfo,
  success: IconCheck,
  warning: IconWarning,
  danger: IconWarning,
} as const;

export function Notice({ tone = 'info', children, onDismiss, role }: NoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`notice notice--${tone}`}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
    >
      <span className="notice__icon">
        <Icon size={17} />
      </span>
      <div className="notice__content">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="notice__dismiss"
          onClick={onDismiss}
          aria-label="بستن پیام"
        >
          <IconClose size={15} />
        </button>
      ) : null}
    </div>
  );
}
