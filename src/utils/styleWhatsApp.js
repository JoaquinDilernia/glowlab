// WhatsApp (Style). Mismo criterio que normalize() en functions/style-whatsapp.js,
// para que el editor arranque desde la config vieja ({ enabled, backgroundColor, hoverColor }).

export const SIZES = { sm: 48, md: 56, lg: 64 };
export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DEFAULTS = {
  enabled: false,
  version: 2,
  phone: '',
  message: '',
  productMessage: 'Hola! Quiero consultar por {producto}',
  label: '',
  labelMode: 'desktop',
  greeting: '',
  greetingDelay: 6,
  side: 'right',
  offsetX: 20,
  offsetY: 20,
  mobileOffsetY: 16,
  size: 'md',
  shape: 'circle',
  backgroundColor: '#25d366',
  iconColor: '#ffffff',
  hoverColor: '#1ebe5b',
  pulse: false,
  devices: 'both',
  hours: { enabled: false, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' },
};

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fb) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);

export function normalizeWhatsApp(input) {
  const c = input || {};
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  return {
    ...out,
    version: 2,
    enabled: c.enabled === true,
    backgroundColor: hexOr(c.backgroundColor, DEFAULTS.backgroundColor),
    iconColor: hexOr(c.iconColor, DEFAULTS.iconColor),
    hoverColor: hexOr(c.hoverColor, hexOr(c.backgroundColor, DEFAULTS.hoverColor)),
    hours: { ...DEFAULTS.hours, ...(c.hours || {}) },
  };
}

// "5491131440631" -> "+54 9 11 3144-0631" (solo para mostrar)
export function prettyPhone(d) {
  const s = String(d || '').replace(/\D/g, '');
  const m = /^54(9?)(11|\d{3,4})(\d{3,4})(\d{4})$/.exec(s);
  return m ? `+54 ${m[1] ? '9 ' : ''}${m[2]} ${m[3]}-${m[4]}` : s ? `+${s}` : '';
}

export function inHoursNow(h, ms = Date.now()) {
  if (!h || !h.enabled) return true;
  const d = new Date(ms - 3 * 3600 * 1000);
  const day = d.getUTCDay();
  const min = d.getUTCHours() * 60 + d.getUTCMinutes();
  const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const from = toMin(h.from);
  const to = toMin(h.to);
  if (from === to) return h.days.includes(day);
  if (from < to) return h.days.includes(day) && min >= from && min < to;
  return (h.days.includes(day) && min >= from) || (h.days.includes((day + 6) % 7) && min < to);
}
