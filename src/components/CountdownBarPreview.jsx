import { MOBILE_SCALE, effectiveSizes } from '../utils/countdown';

const UNITS = [
  { k: 'd', lbl: 'días', short: 'd' },
  { k: 'h', lbl: 'hs', short: 'h' },
  { k: 'm', lbl: 'min', short: 'm' },
  { k: 's', lbl: 'seg', short: 's' },
];

function hexA(h, a) {
  const n = parseInt(String(h || '#000000').slice(1), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const pad = (n) => (n < 10 ? `0${n}` : String(n));

function splitTime(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

// Barra de cuenta regresiva tal como la dibuja la tienda.
// endMs: fecha de fin (ms). Si no hay fecha, muestra 2d 04:58:31 de ejemplo.
export default function CountdownBarPreview({ config: c, endMs, now, mobile = false, compact = false }) {
  const s = effectiveSizes(c);
  const k = mobile ? MOBILE_SCALE : 1;
  const px = (n) => `${Math.round(n * k)}px`;
  const left = Number.isFinite(endMs) ? endMs - now : (2 * 86400 + 4 * 3600 + 58 * 60 + 31) * 1000;
  const t = splitTime(left);
  const showDays = t.d > 0;
  const font = c.font === 'inherit' ? '"Poppins", sans-serif' : `"${c.font}", sans-serif`;
  const shortMsg = (c.message || '').length <= 22;
  const showBtn = c.buttonText && (!mobile || !c.hideButtonOnMobile);
  const style = c.timerStyle || 'boxes';

  const unitStyle = style === 'boxes'
    ? { minWidth: px(s.box), padding: mobile ? '4px 3px' : '5px 4px', borderRadius: 6, border: `1px solid ${hexA(c.boxColor, 0.35)}`, background: hexA(c.boxColor, 0.12), flexDirection: 'column' }
    : style === 'inline'
      ? { flexDirection: 'row', alignItems: 'baseline', gap: 1 }
      : { flexDirection: 'column' };

  return (
    <div
      className="cd-preview-bar"
      style={{
        position: 'relative', width: '100%', boxSizing: 'border-box', background: c.backgroundColor, color: c.textColor,
        fontFamily: font, padding: mobile ? `${px(s.padY)} 40px ${px(s.padY)} 12px` : `${s.padY}px 48px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
        gap: mobile ? '6px 10px' : '6px 18px', lineHeight: 1.2, textAlign: 'center',
        boxShadow: c.placement === 'bottom' && !compact ? '0 -4px 16px rgba(0,0,0,.15)' : 'none',
      }}
    >
      {c.message && (
        <p style={{ margin: 0, fontSize: px(s.msg), fontWeight: 600, letterSpacing: '.01em', flexBasis: mobile && !shortMsg ? '100%' : 'auto' }}>
          {c.message}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: style === 'inline' ? 7 : 4, color: c.timerColor, fontVariantNumeric: 'tabular-nums' }}>
        {UNITS.map((u, i) => {
          if (u.k === 'd' && !showDays) return null;
          const val = u.k === 'd' ? String(t.d) : pad(t[u.k]);
          const label = style === 'inline' || (style === 'boxes' && c.showLabels);
          return (
            <span key={u.k} style={{ display: 'contents' }}>
              {style === 'clock' && i > 0 && (u.k !== 'h' || showDays) && (
                <span style={{ fontSize: px(s.digit), fontWeight: 700, opacity: 0.6, padding: '0 1px' }}>:</span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, ...unitStyle }}>
                <span style={{ fontSize: px(s.digit), fontWeight: 700 }}>{val}</span>
                {label && (
                  <span style={style === 'inline'
                    ? { fontSize: Math.round(s.digit * 0.7 * k), opacity: 0.8 }
                    : { fontSize: px(s.label), fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.75, marginTop: 3 }}>
                    {style === 'inline' ? u.short : u.lbl}
                  </span>
                )}
              </span>
            </span>
          );
        })}
      </div>
      {showBtn && (
        <span style={{
          display: 'inline-block', background: c.buttonColor, color: c.buttonTextColor, fontSize: px(s.btn), fontWeight: 700,
          letterSpacing: '.06em', textTransform: 'uppercase', padding: mobile ? '6px 12px' : '8px 18px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>
          {c.buttonText}
        </span>
      )}
      {c.showCloseButton && (
        <span aria-hidden="true" style={{ position: 'absolute', right: mobile ? 4 : 10, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </span>
      )}
    </div>
  );
}
