// Style > Banners (editor v2). Misma forma que functions/style-banners.js.

export const POSITIONS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
export const SIZE = { sm: [18, 13, 12, '8px 16px'], md: [26, 15, 14, '11px 24px'], lg: [36, 17, 15, '14px 30px'] };

export const BUTTON_DEFAULTS = { text: '', url: '', newTab: false, style: 'solid', bg: '#ffffff', color: '#353434' };

export const ITEM_DEFAULTS = {
  blockId: '', thumb: '', enabled: true,
  title: '', subtitle: '', textColor: '#ffffff', uppercase: false,
  position: 'center', mobilePosition: 'same', align: 'center',
  overlay: 0, size: 'md', radius: 4, buttons: [],
};

export function normalizeBanners(value) {
  const v = value || {};
  const isNew = v.version === 2;
  return {
    enabled: isNew ? v.enabled === true : false,
    version: 2,
    items: (isNew && Array.isArray(v.items) ? v.items : []).map(i => ({
      ...ITEM_DEFAULTS, ...i,
      buttons: (Array.isArray(i?.buttons) ? i.buttons : []).map(b => ({ ...BUTTON_DEFAULTS, ...b })),
    })),
  };
}

// Tiene algo para mostrar en la tienda
export const hasContent = (it) => !!(it.title || it.subtitle || it.buttons.some(b => b.text));

export function placeStyle(pos) {
  const v = pos.startsWith('top') ? 'flex-start' : pos.startsWith('bottom') ? 'flex-end' : 'center';
  const h = /left$/.test(pos) ? 'flex-start' : /right$/.test(pos) ? 'flex-end' : 'center';
  return { justifyContent: v, alignItems: h };
}

export function buttonStyle(b, it, scale = 1) {
  const z = SIZE[it.size] || SIZE.md;
  const base = { fontSize: Math.round(z[2] * scale), padding: b.style === 'link' ? 0 : z[3].split(' ').map(p => `${Math.round(parseInt(p, 10) * scale)}px`).join(' '), borderRadius: it.radius };
  if (b.style === 'solid') return { ...base, background: b.bg, color: b.color, borderColor: b.bg };
  if (b.style === 'outline') return { ...base, borderColor: b.bg, color: b.bg, background: 'transparent' };
  return { ...base, color: b.bg, background: 'none', border: 0, textDecoration: 'underline' };
}
