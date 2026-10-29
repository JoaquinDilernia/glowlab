"use strict";

// Prefijos de SKU cargados en el panel (Grupos de Variantes, Ficha tecnica).
// "m, mec" o ["M", "MEC"] -> ["M", "MEC"]. Solo letras y numeros, sin repetir.
function sanitizeSkuPrefixes(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\s,;]+/);
  const out = [];
  for (const raw of list) {
    const prefix = String(raw || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,12}$/.test(prefix) || out.includes(prefix)) continue;
    out.push(prefix);
    if (out.length >= 20) break;
  }
  return out;
}

function matchesSkuPrefix(sku, prefixes) {
  const key = String(sku || "").toUpperCase();
  return (prefixes || []).some((p) => key.startsWith(p));
}

module.exports = { sanitizeSkuPrefixes, matchesSkuPrefix };
