import { useEffect, useState } from 'react';

// Mismos valores que SIZES / MOBILE_SCALE en functions/countdown.js (el script de la tienda).
export const SIZES = {
  sm: { msg: 13, digit: 15, label: 9, padY: 7, box: 34, btn: 12 },
  md: { msg: 15, digit: 18, label: 10, padY: 9, box: 40, btn: 13 },
  lg: { msg: 17, digit: 22, label: 11, padY: 12, box: 48, btn: 14 },
};
export const MOBILE_SCALE = 0.85;

// Hora actual que se actualiza cada segundo.
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function formatDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Carga una fuente de Google Fonts una sola vez (para la vista previa).
export function loadFont(name) {
  const id = 'cd-font-' + name.replace(/s+/g, '-');
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id;
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + ':wght@400;500;600;700&display=swap';
  document.head.appendChild(l);
}

// Igual que en functions/countdown.js: la letra a mano pisa la del tamaño y
// las cajitas / etiquetas acompañan a los numeros.
export function effectiveSizes(c) {
  const base = SIZES[c.size] || SIZES.md;
  const digit = c.digitSize || base.digit;
  return {
    msg: c.messageSize || base.msg, digit, padY: base.padY, btn: base.btn,
    box: Math.max(base.box, Math.round(digit * 2.2)), label: Math.max(base.label, Math.round(digit * 0.5)),
  };
}
