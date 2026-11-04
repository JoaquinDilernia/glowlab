// Style > Barra de encabezado (editor v2). Mismo criterio que normalize() de
// functions/style-top-header.js: arranca desde la config vieja sin perder nada.

export const FONTS = ['inherit', 'Poppins', 'Montserrat', 'Inter', 'Oswald', 'Lato', 'Roboto'];
export const SEPARATORS = ['|', '·', '/', '•', ''];

export const DEFAULTS = {
  enabled: false, version: 2, items: [],
  placement: 'top', sticky: false, alignment: 'left', separator: '|',
  backgroundColor: '#fafafa', textColor: '#353434', accentColor: '#353434',
  borderBottom: true, borderColor: '#e6e6e6',
  font: 'inherit', fontSize: 12, mobileFontSize: 11, padding: 7,
  uppercase: false, letterSpacing: 0.2,
  currentStyle: 'bold', autoCurrent: true, mobileMode: 'scroll',
};

export const ITEM_DEFAULTS = { text: '', icon: '', link: '', newTab: false, current: false, side: 'left', devices: 'both', hidden: false };

function legacyFont(c) {
  if (FONTS.includes(c.font)) return c.font;
  const m = /'([^']+)'/.exec(String(c.fontFamily || ''));
  return m && FONTS.includes(m[1]) ? m[1] : 'inherit';
}

export function normalizeTopHeader(value) {
  const c = value || {};
  if (c.version === 2) {
    return { ...DEFAULTS, ...c, items: (c.items || []).map(i => ({ ...ITEM_DEFAULTS, ...i })) };
  }
  return {
    ...DEFAULTS,
    enabled: c.enabled === true,
    alignment: ['left', 'center', 'right', 'space-between'].includes(c.alignment) ? c.alignment : DEFAULTS.alignment,
    backgroundColor: c.backgroundColor || DEFAULTS.backgroundColor,
    textColor: c.textColor || DEFAULTS.textColor,
    accentColor: c.textColor || DEFAULTS.accentColor,
    font: legacyFont(c),
    items: (c.items || []).map(i => ({
      ...ITEM_DEFAULTS,
      text: i.text || '', icon: i.icon || '', link: i.link || '',
      current: i.active === true, side: i.position === 'right' ? 'right' : 'left',
    })),
  };
}

export const hostOf = (link) => { try { return new URL(link, 'https://x.invalid').hostname.replace(/^www\./, ''); } catch { return ''; } };

// Cual se marca como "estas aca" mirando la tienda en `host`
export function currentIndex(c, host) {
  const visible = c.items.map((it, i) => [it, i]).filter(([it]) => !it.hidden && it.text);
  const manual = visible.find(([it]) => it.current);
  if (manual) return manual[1];
  if (!c.autoCurrent || !host) return -1;
  const auto = visible.find(([it]) => it.link && hostOf(it.link) === host.replace(/^www\./, ''));
  return auto ? auto[1] : -1;
}

