// Shop the Look (editor v2). Mismo criterio que normalize() de
// functions/style-shop-the-look.js: arranca desde la config vieja sin perder nada.

export const DEFAULTS = {
  enabled: false, version: 2,
  title: 'Shop the Look', subtitle: '',
  layout: 'split', imageSide: 'left',
  placement: { sectionId: '', position: 'after' },
  injectSelector: '', injectPosition: 'after',
  dotColor: '#ffffff', dotTextColor: '#353434', dotStyle: 'number', pulse: true,
  accentColor: '#353434', buttonLabel: 'Ver producto',
  showPrice: true, hideSoldOut: true,
  looks: [],
};

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fb) => (typeof v === 'string' && HEX.test(v) ? v : fb);

export const newLook = () => ({ id: 'look_' + Date.now(), imageUrl: '', mobileImageUrl: '', caption: '', hotspots: [] });

export function normalizeShopTheLook(value) {
  const c = value || {};
  const looks = (c.looks || []).map(l => ({ ...newLook(), ...l, hotspots: (l.hotspots || []).filter(h => typeof h.x === 'number' && typeof h.y === 'number') }));
  if (c.version === 2) return { ...DEFAULTS, ...c, placement: { ...DEFAULTS.placement, ...(c.placement || {}) }, looks };
  return {
    ...DEFAULTS,
    enabled: c.enabled === true,
    title: c.title ?? DEFAULTS.title,
    subtitle: c.subtitle || '',
    layout: 'hotspots',
    injectSelector: c.injectSelector || '',
    injectPosition: c.injectPosition || 'after',
    dotColor: hexOr(c.hotspotColor, DEFAULTS.dotColor),
    dotTextColor: hexOr(c.hotspotTextColor, DEFAULTS.dotTextColor),
    dotStyle: c.hotspotLabelMode === 'plus' ? 'plus' : 'number',
    pulse: (c.hotspotAnimation || 'pulse') === 'pulse',
    accentColor: hexOr(c.hoverCardButtonBg, DEFAULTS.accentColor),
    buttonLabel: c.hoverCardButtonLabel || DEFAULTS.buttonLabel,
    hideSoldOut: false,
    looks,
  };
}

export const SECTION_TYPES = {
  banners: 'Banners', 'product-list': 'Lista de productos', 'rich-text': 'Texto', divider: 'Separador',
  'icon-text': 'Íconos con texto', newsletter: 'Newsletter', slider: 'Carrusel', video: 'Video',
  categories: 'Categorías', 'image-text': 'Imagen y texto', testimonials: 'Testimonios',
};

// "Banners · Muebles hasta 30%OFF" / "Lista de productos 2"
export function sectionLabel(s, all) {
  const name = SECTION_TYPES[s.type] || s.type.replace(/-/g, ' ');
  if (s.title) return `${name} · ${s.title}`;
  const same = all.filter(x => x.type === s.type);
  return same.length > 1 ? `${name} ${same.indexOf(s) + 1}` : name;
}

const pickLang = (v) => (v && typeof v === 'object' ? v.es || Object.values(v)[0] || '' : v || '');

export function formatPrice(p) {
  const n = parseFloat(String(p ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '';
  const dec = n % 1 !== 0;
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
}

// Producto de la API -> lo que se guarda en el punto (el panel lo muestra;
// la tienda igual lo pide de nuevo a Tiendanube para tener precio y stock al dia).
export function productSnapshot(p) {
  const v = (p.variants || [])[0] || {};
  const promo = parseFloat(v.promotional_price);
  const price = parseFloat(v.price);
  const handle = pickLang(p.handle);
  return {
    productId: String(p.id),
    productName: pickLang(p.name),
    productImage: p.images?.[0]?.src || '',
    productPrice: formatPrice(promo > 0 && promo < price ? promo : price),
    productUrl: handle ? `/productos/${handle}/` : '',
  };
}
