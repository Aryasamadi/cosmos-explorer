import type { SkySnapshot } from '../../astronomy/types';
import { getSkyBodies } from '../../catalog/bodies';
import { formatAngle, formatBodyKind } from '../../app/format';
import { Sheet } from '../../components/Sheet';

interface SkyObjectsSheetProps {
  open: boolean;
  onClose: () => void;
  snapshot: SkySnapshot | null;
  selectedBodyId: string;
  onSelect: (bodyId: string) => void;
}

export function SkyObjectsSheet({
  open,
  onClose,
  snapshot,
  selectedBodyId,
  onSelect,
}: SkyObjectsSheetProps) {
  const bodies = getSkyBodies();
  const solarBodies = bodies.filter((body) => Boolean(body.ephemerisTarget));
  const stars = bodies.filter((body) => Boolean(body.starFix));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="اجرام آسمان"
      subtitle="ارتفاع و سمت برای مکان و زمان انتخاب‌شده محاسبه شده است"
    >
      <section className="settings-section">
        <h3>منظومهٔ شمسی</h3>
        <ul className="object-list">
          {solarBodies.map((body) => {
            const position = snapshot?.positions.find((item) => item.bodyId === body.id);
            return (
              <li key={body.id}>
                <button
                  type="button"
                  className={`object-row ${body.id === selectedBodyId ? 'is-selected' : ''}`}
                  onClick={() => {
                    onSelect(body.id);
                    onClose();
                  }}
                >
                  <span
                    className="object-row__swatch"
                    style={{ background: body.accentColor }}
                    aria-hidden="true"
                  />
                  <span className="object-row__main">
                    <span className="object-row__name">
                      {body.nameFa} <small dir="ltr">{body.nameEn}</small>
                    </span>
                    <span className="object-row__meta">
                      {formatBodyKind(body.kind)}
                      {position
                        ? ` · ارتفاع ${formatAngle(position.horizontal.altitudeDeg)} · سمت ${formatAngle(
                            position.horizontal.azimuthDeg,
                          )}`
                        : ' · محاسبه نشده'}
                    </span>
                  </span>
                  <span
                    className={`object-row__status ${
                      position?.isAboveHorizon ? 'is-above' : 'is-below'
                    }`}
                  >
                    {position?.isAboveHorizon ? 'بالای افق' : 'زیر افق'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-section">
        <h3>ستارگان درخشان</h3>
        <p className="settings-text settings-text--muted">
          این فهرست کوتاه برای شناخت آسمان است و جایگزین کاتالوگ کامل ستارگان نیست. جای ستارگان
          با ستارهٔ مرجع J2000 و بدون حرکت خاص محاسبه می‌شود.
        </p>
        <ul className="object-list">
          {stars.map((body) => {
            const position = snapshot?.positions.find((item) => item.bodyId === body.id);
            return (
              <li key={body.id}>
                <button
                  type="button"
                  className={`object-row object-row--compact ${
                    body.id === selectedBodyId ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    onSelect(body.id);
                    onClose();
                  }}
                >
                  <span
                    className="object-row__swatch object-row__swatch--star"
                    style={{ background: body.accentColor }}
                    aria-hidden="true"
                  />
                  <span className="object-row__main">
                    <span className="object-row__name">
                      {body.nameFa} <small dir="ltr">{body.nameEn}</small>
                    </span>
                    <span className="object-row__meta">
                      {position
                        ? `ارتفاع ${formatAngle(position.horizontal.altitudeDeg)} · سمت ${formatAngle(
                            position.horizontal.azimuthDeg,
                          )}`
                        : 'محاسبه نشده'}
                    </span>
                  </span>
                  <span
                    className={`object-row__status ${
                      position?.isAboveHorizon ? 'is-above' : 'is-below'
                    }`}
                  >
                    {position?.isAboveHorizon ? 'بالای افق' : 'زیر افق'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </Sheet>
  );
}
