// Barra de anuncios (Style). Mismo criterio que normalize() en
// functions/top-announcement.js, para que el editor arranque desde la config
// vieja (fontFamily, insertMode, borderEnabled) sin perder nada.

export const FONTS = ['inherit', 'Poppins', 'Montserrat', 'Inter', 'Oswald', 'Bebas Neue', 'Playfair Display', 'Lato', 'Roboto'];
export const SEPARATORS = ['|', '•', '·', '—', '/', ''];

export const DEFAULTS = {
  version: 2,
  enabled: false,
  messages: [],
  placement: 'below-header',
  sticky: true,
  desktopMode: 'static',
  mobileMode: 'rotate',
  rotateSeconds: 4,
  marqueeSpeed: 40,
  separator: '|',
  alignment: 'center',
  messageGap: 18,
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  linkUnderline: 'hover',
  font: 'inherit',
  fontSize: 13,
  mobileFontSize: 12,
  fontWeight: 500,
  uppercase: false,
  letterSpacing: 0.3,
  padding: 11,
  borderBottom: false,
  borderTop: false,
  borderColor: '#e3e3e3',
  visibility: 'both',
};

export const EMPTY_MESSAGE = {
  text: '', link: '', emoji: '', highlight: 'none', highlightColor: '#ffd166', startDate: null, endDate: null, newTab: false,
};

export function normalizeTopBar(raw) {
  const c = raw || {};
  const v2 = c.version === 2;
  let font = c.font;
  if (!FONTS.includes(font)) {
    const m = /^'([^']+)'/.exec(String(c.fontFamily || ''));
    font = !v2 && m && FONTS.includes(m[1]) ? m[1] : 'inherit';
  }
  let placement = c.placement;
  if (!['below-header', 'above-logo', 'top'].includes(placement)) {
    placement = !v2 && (c.insertMode === 'before-header' || c.insertMode === 'inside-header-top') ? 'top' : 'below-header';
  }
  const legacyOff = !v2 && c.borderEnabled === false;
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  return {
    ...out,
    version: 2,
    font,
    placement,
    borderBottom: legacyOff ? false : c.borderBottom === true,
    borderTop: legacyOff ? false : c.borderTop === true,
    mobileFontSize: c.mobileFontSize ?? Math.min(Number(c.fontSize) || 13, 12),
    messages: (c.messages || []).map(m => ({ ...EMPTY_MESSAGE, ...m, text: m.text || '' })),
  };
}

export function messageStatus(m, now) {
  const start = Date.parse(m.startDate);
  const end = Date.parse(m.endDate);
  if (Number.isFinite(end) && end <= now) return 'ended';
  if (Number.isFinite(start) && start > now) return 'scheduled';
  return 'live';
}

export function textColorFor(hex) {
  const n = parseInt(String(hex || '#000000').slice(1), 16) || 0;
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#111111' : '#ffffff';
}
