"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWidgetScript } = require("./search");

test("el overlay cerrado no debe bloquear clicks en el resto de la pagina", () => {
  // Bug reportado: despues de cerrar el buscador una vez, la tienda queda
  // "trabada" y no deja escribir. La causa es que .pn-search-overlay usa
  // position: fixed; inset: 0; z-index: 999999 SIEMPRE (visible o no, solo
  // cambia opacity), asi que sin pointer-events:none el div invisible sigue
  // capturando todos los clicks de la pagina despues del primer cierre.
  const script = buildWidgetScript("123", { template: "minimal" });

  const baseRuleMatch = script.match(/\.pn-search-overlay\s*\{[^}]*\}/);
  assert.ok(baseRuleMatch, "no se encontro la regla base .pn-search-overlay");
  assert.match(
    baseRuleMatch[0],
    /pointer-events:\s*none/,
    "el overlay cerrado (opacity 0) debe tener pointer-events: none para no tapar el resto de la tienda"
  );

  const openRuleMatch = script.match(/\.pn-search-overlay\.pn-open\s*\{[^}]*\}/);
  assert.ok(openRuleMatch, "no se encontro la regla .pn-search-overlay.pn-open");
  assert.match(
    openRuleMatch[0],
    /pointer-events:\s*auto/,
    "al abrirse el overlay debe reactivar pointer-events para poder interactuar con el popup"
  );
});
