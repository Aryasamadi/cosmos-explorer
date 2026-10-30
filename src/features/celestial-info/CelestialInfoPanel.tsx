import { useEffect } from 'react';
import type { CelestialBody } from '../../catalog/types';
import { getDataSource } from '../../catalog/sources';
import type { SkyObjectPosition } from '../../astronomy/types';
import { DISPLAY_SCALE_NOTICE_FA } from '../../config/display';
import {
  DATA_TYPE_FA,
  formatAngle,
  formatBodyKind,
  formatDistanceKm,
  formatFactValue,
  formatIllumination,
  formatLocalDateTime,
  formatNumber,
} from '../../app/format';
import { IconClose, IconExternal, IconTarget } from '../../components/Icons';
import { Notice } from '../../components/Notice';

export interface CelestialInfoPanelProps {
  body: CelestialBody;
  mode: 'free' | 'sky';
  open: boolean;
  onClose: () => void;
  onFocus?: () => void;
  position?: SkyObjectPosition | null;
  timestamp?: Date | null;
}

export function CelestialInfoPanel({
  body,
  mode,
  open,
  onClose,
  onFocus,
  position = null,
  timestamp = null,
}: CelestialInfoPanelProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sourceIds = new Set<string>(body.sourceIds);
  for (const fact of body.facts) {
    for (const sourceId of fact.sourceIds) sourceIds.add(sourceId);
  }
  const sources = [...sourceIds]
    .map((sourceId) => getDataSource(sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  return (
    <aside
      className="info-panel glass"
      aria-label={`اطلاعات ${body.nameFa}`}
      data-testid="celestial-info-panel"
    >
      <div className="info-panel__handle" aria-hidden="true" />
      <header className="info-panel__header">
        <div className="info-panel__title-wrap">
          <span
            className="info-panel__swatch"
            style={{
              background: `radial-gradient(circle at 32% 28%, #fff8, transparent 55%), ${body.accentColor}`,
            }}
            aria-hidden="true"
          />
          <div>
            <p className="info-panel__kicker">{formatBodyKind(body.kind)}</p>
            <h2 className="info-panel__title">{body.nameFa}</h2>
            <p className="info-panel__latin" dir="ltr">
              {body.nameEn}
            </p>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="بستن اطلاعات">
          <IconClose size={19} />
        </button>
      </header>

      <p className="info-panel__description">{body.descriptionFa}</p>

      {mode === 'free' && onFocus ? (
        <div className="info-panel__actions">
          <button
            type="button"
            className="button button--glass info-panel__focus"
            onClick={onFocus}
            aria-label={`فوکوس روی ${body.nameFa}`}
          >
            <IconTarget size={16} />
            فوکوس روی این جرم
          </button>
        </div>
      ) : null}

      {mode === 'sky' ? (
        <section className="live-card" aria-label="موقعیت لحظه‌ای">
          <h3>موقعیت در آسمان ناظر</h3>
          {!position ? (
            <Notice tone="warning">
              برای این جرم در لحظهٔ فعلی موقعیت محاسبه‌شده‌ای در دسترس نیست. این جرم از دید
              ناظر زمینی در آسمان قرار نمی‌گیرد یا محاسبهٔ آن انجام نشده است.
            </Notice>
          ) : (
            <>
              <div className="live-grid">
                <div>
                  <span>ارتفاع</span>
                  <strong>{formatAngle(position.horizontal.altitudeDeg)}</strong>
                </div>
                <div>
                  <span>سمت</span>
                  <strong>{formatAngle(position.horizontal.azimuthDeg)}</strong>
                </div>
                {!body.starFix && Number.isFinite(position.distanceKm ?? NaN) ? (
                  <div>
                    <span>فاصلهٔ لحظه‌ای</span>
                    <strong>{formatDistanceKm(position.distanceKm ?? 0)}</strong>
                  </div>
                ) : null}
                {position.apparentMagnitude !== null ? (
                  <div>
                    <span>قدر ظاهری</span>
                    <strong>{formatNumber(position.apparentMagnitude, 2)}</strong>
                  </div>
                ) : null}
                {position.illuminationFraction !== null ? (
                  <div>
                    <span>بخش روشن ماه</span>
                    <strong>{formatIllumination(position.illuminationFraction)}</strong>
                  </div>
                ) : null}
              </div>
              <p className="live-card__summary">
                {position.isAboveHorizon
                  ? 'در این لحظه بالای افق قرار دارد.'
                  : 'در این لحظه زیر افق قرار دارد.'}
              </p>
              {!position.isAboveHorizon ? (
                <Notice tone="warning">
                  این جرم در زمان انتخاب‌شده زیر افق است و در نمای آسمان پنهان می‌ماند.
                </Notice>
              ) : null}
              <p className="live-card__note">
                ارتفاع و سمت به‌صورت هندسی و بدون شکست نور جو، با Astronomy Engine
                محاسبه شده‌اند.
                {timestamp ? ` زمان محاسبه: ${formatLocalDateTime(timestamp)}.` : ''}
              </p>
            </>
          )}
        </section>
      ) : (
        <Notice tone="info">{DISPLAY_SCALE_NOTICE_FA}</Notice>
      )}

      <section className="facts" aria-label="مشخصات علمی">
        <h3>مشخصات علمی</h3>
        <dl>
          {body.facts.map((fact) => (
            <div className="fact-row" key={fact.id}>
              <dt>
                {fact.labelFa}
                {fact.noteFa ? <span className="fact-row__note">{fact.noteFa}</span> : null}
              </dt>
              <dd>
                <span className="fact-row__value" data-testid={`fact-${fact.id}`}>
                  {formatFactValue(fact)}
                </span>
                <span className={`type-badge type-badge--${fact.dataType}`}>
                  {DATA_TYPE_FA[fact.dataType]}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="info-sources" aria-label="منابع داده">
        <h3>منابع</h3>
        <ul>
          {sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.titleFa}
                <span>{source.publisherFa}</span>
                <IconExternal size={13} />
              </a>
            </li>
          ))}
        </ul>
        <p className="info-sources__note">
          مقادیر متغیر با برچسب نوع داده مشخص شده‌اند. برای داده‌های دارای عدم قطعیت، مقدار
          نمایش‌داده‌شده تقریبی است.
        </p>
      </section>
    </aside>
  );
}
