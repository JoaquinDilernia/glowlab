// Menú principal (Style). Mismo criterio que normalize() en functions/style-menu.js,
// para que el editor arranque desde la config vieja (position "1.2", fontWeight
// "bold", fontSize "16px") sin perder nada.

export const ITEM_DEFAULTS = {
  target: { mode: 'text', text: '', parent: '', position: '' },
  emoji: '',
  emojiPosition: 'before',
  color: null,
  fontWeight: null,
  fontSize: null,
  uppercase: false,
  look: 'text',
  pillColor: '#8aa1c4',
  pillTextColor: '#ffffff',
  badge: '',
  badgeColor: '#353434',
  badgeTextColor: '#ffffff',
  hidden: false,
  devices: 'both',
  startDate: null,
  endDate: null,
  imageUrl: '',
  imageMobileUrl: '',
  imageLink: '',
  imageCaption: '',
  imageOnMobile: true,
};

// Menu de muestra (Alto Rancho) para la vista previa si no se pudo leer el real.
export const SAMPLE_TREE = [
  { label: 'Alto Cyber.', children: ['Muebles hasta 30%OFF', 'Sillas hasta 50%OFF', 'Iluminación hasta 40%OFF'] },
  { label: 'Sillas', children: ['New in', 'Best sellers', 'Sillas', 'Banquetas'] },
  { label: 'Muebles', children: ['New in', 'Best sellers', 'Living', 'Home office'] },
  { label: 'Iluminación', children: ['New in', 'Best sellers', 'Veladores'] },
  { label: 'Decoración', children: ['Floreros y Jarrones', 'Libros', 'Velas'] },
  { label: 'Gift Card', children: [] },
  { label: 'SALE', children: ['Hasta 30% OFF en muebles', 'Hasta 60% OFF en sillas'] },
];

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fb) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);

function weight(v) {
  if (v == null || v === '' || v === 'normal') return null;
  if (v === 'bold') return 700;
  const n = Number(v);
  return [300, 400, 500, 600, 700, 800].includes(n) ? n : null;
}
function fontPx(v) {
  if (v == null || v === '') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px|rem|em)?\s*$/i.exec(String(v));
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2] && m[2].toLowerCase() !== 'px') n *= 16;
  return Math.min(32, Math.max(9, Math.round(n)));
}

export function normalizeItem(input) {
  const c = input || {};
  const d = ITEM_DEFAULTS;
  const t = c.target || {};
  const position = String(t.position ?? c.position ?? '').trim();
  const text = String(t.text || '');
  const mode = t.mode === 'text' || t.mode === 'position' ? t.mode : (text ? 'text' : 'position');
  return {
    ...d,
    ...c,
    target: { mode, text, parent: String(t.parent || ''), position },
    emojiPosition: c.emojiPosition === 'after' ? 'after' : 'before',
    color: hexOr(c.color, null),
    fontWeight: weight(c.fontWeight),
    fontSize: fontPx(c.fontSize),
    look: c.look === 'pill' ? 'pill' : 'text',
    pillColor: hexOr(c.pillColor, d.pillColor),
    pillTextColor: hexOr(c.pillTextColor, d.pillTextColor),
    badgeColor: hexOr(c.badgeColor, d.badgeColor),
    badgeTextColor: hexOr(c.badgeTextColor, d.badgeTextColor),
    devices: ['both', 'desktop', 'mobile'].includes(c.devices) ? c.devices : 'both',
    imageOnMobile: c.imageOnMobile === undefined ? !!c.imageMobileUrl || !c.imageUrl : c.imageOnMobile === true,
    emoji: c.emoji || '',
    badge: c.badge || '',
    imageUrl: c.imageUrl || '',
    imageMobileUrl: c.imageMobileUrl || '',
    imageLink: c.imageLink || '',
    imageCaption: c.imageCaption || '',
    startDate: c.startDate || null,
    endDate: c.endDate || null,
  };
}

export function normalizeMenu(input) {
  const c = input || {};
  const items = (Array.isArray(c.items) ? c.items : []).map(normalizeItem);
  // Campos que el editor viejo usaba y el nuevo no (megaMenu, position) se descartan.
  return {
    enabled: c.enabled === true,
    version: 2,
    items: items.map((it) => { const rest = { ...it }; delete rest.megaMenu; delete rest.position; return rest; }),
  };
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Busca el item en el arbol -> { top, sub } con indices, o null.
export function locate(tree, target) {
  if (!target) return null;
  if (target.mode === 'position') {
    const [a, b] = String(target.position).split('.').map(Number);
    const main = tree[a - 1];
    if (!main) return null;
    if (!b) return { top: a - 1, sub: null };
    return main.children[b - 1] != null ? { top: a - 1, sub: b - 1 } : null;
  }
  const want = norm(target.text);
  const parent = norm(target.parent);
  if (!want) return null;
  if (!parent) {
    const i = tree.findIndex(n => norm(n.label) === want);
    if (i >= 0) return { top: i, sub: null };
  }
  for (let i = 0; i < tree.length; i++) {
    if (parent && norm(tree[i].label) !== parent) continue;
    const j = tree[i].children.findIndex(s => norm(s) === want);
    if (j >= 0) return { top: i, sub: j };
  }
  return null;
}

export function targetName(target, tree) {
  if (!target) return '';
  if (target.mode === 'text') return target.parent ? `${target.parent} › ${target.text}` : target.text;
  const hit = tree && locate(tree, target);
  if (hit) return hit.sub == null ? tree[hit.top].label : `${tree[hit.top].label} › ${tree[hit.top].children[hit.sub]}`;
  return `Posición ${target.position}`;
}

export function itemStatus(it, now) {
  if (it.startDate && now < Date.parse(it.startDate)) return 'scheduled';
  if (it.endDate && now >= Date.parse(it.endDate)) return 'ended';
  return 'live';
}

// Para cada (top, sub) del arbol, el ajuste que le toca (el primero gana).
export function effectsFor(tree, items, { mobile, now }) {
  const map = new Map();
  items.forEach((it) => {
    if (itemStatus(it, now) !== 'live') return;
    if (it.devices === 'desktop' && mobile) return;
    if (it.devices === 'mobile' && !mobile) return;
    const hit = locate(tree, it.target);
    if (!hit) return;
    const key = `${hit.top}:${hit.sub ?? ''}`;
    if (!map.has(key)) map.set(key, it);
  });
  return map;
}
