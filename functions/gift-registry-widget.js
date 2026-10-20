// Lista de Regalos - script del storefront.
//
// El codigo del navegador vive en clientMain() y se serializa con toString():
// asi se escribe como JS normal (sin escapar un template gigante) y lo unico
// que se inyecta es la config en JSON.
"use strict";

const STYLES = [
  ".pn-gr, .pn-gr * { box-sizing: border-box !important; font-family: inherit !important; }",
  ".pn-gr { color: #353434 !important; max-width: 960px !important; margin: 0 auto !important; padding: 8px 0 40px !important; text-align: left !important; }",
  ".pn-gr h2 { font-size: 26px !important; font-weight: 600 !important; margin: 0 0 8px !important; color: #353434 !important; }",
  ".pn-gr h3 { font-size: 17px !important; font-weight: 600 !important; margin: 28px 0 12px !important; color: #353434 !important; }",
  ".pn-gr p { margin: 0 0 12px !important; line-height: 1.5 !important; }",
  ".pn-gr-muted { color: #8a8580 !important; font-size: 13px !important; }",
  ".pn-gr-error { color: #b3261e !important; font-size: 13px !important; min-height: 18px !important; margin: 8px 0 0 !important; }",
  ".pn-gr-cards { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important; gap: 16px !important; margin-top: 20px !important; }",
  ".pn-gr-card { border: 1px solid #e7e2db !important; border-radius: 8px !important; background: #fff !important; padding: 20px !important; }",
  ".pn-gr-btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; background: #353434 !important; color: #fff !important; border: 1px solid #353434 !important; border-radius: 5px !important; padding: 11px 18px !important; font-size: 14px !important; cursor: pointer !important; text-decoration: none !important; line-height: 1.2 !important; }",
  ".pn-gr-btn:hover { opacity: 0.88 !important; }",
  ".pn-gr-btn[disabled] { opacity: 0.5 !important; cursor: wait !important; }",
  ".pn-gr-btn--ghost { background: #fff !important; color: #353434 !important; border-color: #d9d3cb !important; }",
  ".pn-gr-btn--block { width: 100% !important; }",
  ".pn-gr-link { background: none !important; border: none !important; padding: 0 !important; color: #353434 !important; text-decoration: underline !important; cursor: pointer !important; font-size: 13px !important; }",
  ".pn-gr-form { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 14px !important; margin-top: 12px !important; }",
  ".pn-gr-full { grid-column: 1 / -1 !important; }",
  ".pn-gr-field { display: flex !important; flex-direction: column !important; gap: 6px !important; font-size: 13px !important; font-weight: 600 !important; }",
  ".pn-gr-field input, .pn-gr-field select, .pn-gr-field textarea { width: 100% !important; border: 1px solid #d9d3cb !important; border-radius: 5px !important; padding: 10px 12px !important; font-size: 14px !important; font-weight: 400 !important; background: #fff !important; color: #353434 !important; }",
  ".pn-gr-check { display: flex !important; align-items: center !important; gap: 8px !important; font-size: 14px !important; cursor: pointer !important; }",
  ".pn-gr-modes { display: grid !important; gap: 8px !important; }",
  ".pn-gr-mode { display: flex !important; gap: 10px !important; align-items: flex-start !important; border: 1px solid #e7e2db !important; border-radius: 8px !important; padding: 12px !important; cursor: pointer !important; font-weight: 400 !important; }",
  ".pn-gr-mode.is-on { border-color: #353434 !important; background: #faf8f5 !important; }",
  ".pn-gr-mode strong { display: block !important; font-size: 14px !important; }",
  ".pn-gr-mode small { display: block !important; color: #8a8580 !important; font-size: 12px !important; margin-top: 2px !important; }",
  ".pn-gr-cover { height: 220px !important; border-radius: 8px !important; background-color: #f3efe9 !important; background-position: center !important; background-size: cover !important; background-repeat: no-repeat !important; margin-bottom: 18px !important; }",
  ".pn-gr-head { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 12px !important; flex-wrap: wrap !important; }",
  ".pn-gr-actions { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }",
  ".pn-gr-chip { display: inline-block !important; background: #f3efe9 !important; border-radius: 999px !important; padding: 4px 12px !important; font-size: 12px !important; font-weight: 600 !important; margin: 0 6px 6px 0 !important; }",
  ".pn-gr-items { display: flex !important; flex-direction: column !important; }",
  ".pn-gr-item { display: flex !important; gap: 12px !important; align-items: center !important; padding: 12px 0 !important; border-top: 1px solid #f1ede7 !important; }",
  ".pn-gr-thumb { flex: none !important; width: 64px !important; height: 64px !important; border-radius: 6px !important; background-color: #f6f4f1 !important; background-position: center !important; background-size: cover !important; background-repeat: no-repeat !important; }",
  ".pn-gr-info { flex: 1 !important; min-width: 0 !important; }",
  ".pn-gr-info strong { display: block !important; font-size: 14px !important; font-weight: 600 !important; }",
  ".pn-gr-bar { height: 4px !important; background: #f1ede7 !important; border-radius: 999px !important; overflow: hidden !important; margin-top: 6px !important; max-width: 220px !important; }",
  ".pn-gr-bar span { display: block !important; height: 100% !important; background: #4f7a4a !important; }",
  ".pn-gr-qty { display: flex !important; align-items: center !important; gap: 6px !important; flex: none !important; }",
  ".pn-gr-qty button { width: 30px !important; height: 30px !important; border: 1px solid #d9d3cb !important; background: #fff !important; border-radius: 5px !important; cursor: pointer !important; font-size: 16px !important; line-height: 1 !important; color: #353434 !important; padding: 0 !important; }",
  ".pn-gr-qty span { min-width: 22px !important; text-align: center !important; font-size: 14px !important; }",
  ".pn-gr-gift { padding: 10px 0 !important; border-top: 1px solid #f1ede7 !important; font-size: 14px !important; }",
  ".pn-gr-gift em { display: block !important; color: #8a8580 !important; margin-top: 2px !important; }",
  ".pn-gr-share { display: flex !important; gap: 8px !important; margin-top: 8px !important; }",
  ".pn-gr-share input { flex: 1 !important; min-width: 0 !important; border: 1px solid #d9d3cb !important; border-radius: 5px !important; padding: 10px 12px !important; font-size: 13px !important; background: #faf8f5 !important; color: #353434 !important; }",
  ".pn-gr-overlay { position: fixed !important; inset: 0 !important; z-index: 99999 !important; background: #fff !important; overflow-y: auto !important; padding: 24px 16px !important; }",
  ".pn-gr-close { position: fixed !important; top: 12px !important; right: 16px !important; z-index: 100000 !important; }",
  ".pn-gr-pdp { margin: 14px 0 !important; color: #353434 !important; }",
  ".pn-gr-pdp, .pn-gr-pdp * { box-sizing: border-box !important; font-family: inherit !important; }",
  ".pn-gr-pdp select { width: 100% !important; margin-bottom: 8px !important; border: 1px solid #d9d3cb !important; border-radius: 5px !important; padding: 9px 10px !important; font-size: 14px !important; background: #fff !important; color: #353434 !important; }",
  ".pn-gr-pdp-ok { font-size: 13px !important; margin: 8px 0 0 !important; color: #4f7a4a !important; }",
  ".pn-gr-pdp-ok a { color: #353434 !important; text-decoration: underline !important; margin-left: 4px !important; }",
  ".pn-gr-notice { background: #f3efe9 !important; border-radius: 8px !important; padding: 12px 14px !important; font-size: 13px !important; margin: 14px 0 !important; }",
  ".pn-gr-grid { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important; gap: 16px !important; margin-top: 18px !important; }",
  ".pn-gr-gcard { border: 1px solid #e7e2db !important; border-radius: 8px !important; overflow: hidden !important; background: #fff !important; display: flex !important; flex-direction: column !important; }",
  ".pn-gr-gcard.is-done { opacity: 0.5 !important; }",
  ".pn-gr-gimg { aspect-ratio: 1 / 1 !important; background-color: #f6f4f1 !important; background-position: center !important; background-size: cover !important; background-repeat: no-repeat !important; }",
  ".pn-gr-gbody { padding: 12px !important; display: flex !important; flex-direction: column !important; gap: 6px !important; flex: 1 !important; }",
  ".pn-gr-gbody strong { font-size: 14px !important; font-weight: 500 !important; line-height: 1.3 !important; }",
  ".pn-gr-gbody .pn-gr-btn { margin-top: auto !important; }",
  ".pn-gr-gprice { font-size: 15px !important; font-weight: 600 !important; }",
  ".pn-gr-done { margin-top: auto !important; font-size: 13px !important; font-weight: 600 !important; color: #4f7a4a !important; }",
  ".pn-gr-modal-bg { position: fixed !important; inset: 0 !important; z-index: 100001 !important; background: rgba(0,0,0,0.45) !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 16px !important; }",
  ".pn-gr-modal { background: #fff !important; border-radius: 10px !important; padding: 22px !important; width: 100% !important; max-width: 480px !important; max-height: 92vh !important; overflow-y: auto !important; }",
  ".pn-gr-modal h3 { margin: 0 0 4px !important; }",
  ".pn-gr-private { border: 1px solid #e7e2db !important; border-radius: 8px !important; padding: 16px !important; margin: 18px 0 0 !important; background: #fff !important; }",
  ".pn-gr-private.is-new { border-color: #4f7a4a !important; background: #f4f8f3 !important; }",
  ".pn-gr-private h3 { margin: 0 0 6px !important; }",
  "@media (max-width: 640px) { .pn-gr-form { grid-template-columns: 1fr !important; } .pn-gr h2 { font-size: 22px !important; } .pn-gr-cover { height: 160px !important; } .pn-gr-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; } }",
].join("");

// ---------------------------------------------------------------------------
// Codigo del navegador (se serializa: no puede usar nada de este modulo)
// ---------------------------------------------------------------------------

function clientMain(CFG) {
  if (window.__pnGiftRegistry) return;
  window.__pnGiftRegistry = true;

  var API = CFG.api;
  var STORE = CFG.store;
  // Links de edicion de las listas abiertas en este navegador.
  var KEYS_KEY = "pn_gr_keys_" + STORE;

  var MODES = {
    couple_address: { label: "Envío a nuestra casa", hint: "La dirección de ustedes llega cargada en el checkout. El invitado paga el envío." },
    store_pickup: { label: "La tienda los junta y los entrega", hint: "Los invitados eligen retiro en el local y la tienda les entrega todo junto." },
    guest_choice: { label: "Que elija cada invitado", hint: "Cada invitado elige envío o retiro al pagar." },
  };
  var EVENTS = { wedding: "Casamiento", baby: "Baby shower", birthday: "Cumpleaños", housewarming: "Mudanza", other: "Otro" };

  // --- utilidades -----------------------------------------------------------

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (_) { /* sin storage: se recuerda lo que dura la pagina */ }
    return null;
  }
  var memory = { keys: [] };
  try { memory.keys = JSON.parse(store(KEYS_KEY) || "[]").filter(function (k) { return typeof k === "string"; }); } catch (_) { /* vacio */ }
  function saveKeys() { store(KEYS_KEY, memory.keys.length ? JSON.stringify(memory.keys) : null); }
  function rememberKey(key) {
    if (memory.keys.indexOf(key) === -1) { memory.keys.push(key); saveKeys(); }
  }
  function forgetKey(key) {
    memory.keys = memory.keys.filter(function (k) { return k !== key; });
    saveKeys();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function button(text, cls, onClick) {
    var b = el("button", cls || "pn-gr-btn", text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function money(n) {
    return "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }
  function absUrl(u) { return u && u.indexOf("//") === 0 ? "https:" + u : u || ""; }
  function bg(node, url) { if (url) node.style.backgroundImage = "url(\"" + absUrl(url).replace(/"/g, "") + "\")"; }

  // key: link de edicion de la lista (solo en las rutas de los novios).
  function api(method, path, body, key) {
    var headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = "Bearer " + key;
    var url = API + path + (path.indexOf("?") > -1 ? "&" : "?") + "store=" + STORE;
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(Object.assign({ store: STORE }, body)) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (r.status === 401 && key) forgetKey(key);
        if (!r.ok || json.success === false) {
          var err = new Error(json.message || "Algo salió mal. Probá de nuevo.");
          err.status = r.status;
          throw err;
        }
        return json;
      });
    });
  }

  function params() { return new URLSearchParams(window.location.search); }
  function pageUrl(query) { return CFG.pagePath + (query ? "?" + query : ""); }
  function go(query) {
    window.history.pushState({}, "", pageUrl(query));
    route();
  }
  function replace(query) {
    window.history.replaceState({}, "", pageUrl(query));
    route();
  }

  // --- montaje ----------------------------------------------------------------

  var root = null;
  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    var style = document.createElement("style");
    style.id = "pn-gr-styles";
    style.textContent = CFG.styles;
    document.head.appendChild(style);

    root = el("div", "pn-gr");
    var onPage = window.location.pathname === CFG.pagePath;
    var host = onPage && document.querySelector(".user-content, .page-content, [data-store='page-content'], main .container");
    if (host) {
      host.innerHTML = "";
      host.appendChild(root);
    } else {
      // Fuera de la pagina de la lista (?lista= en cualquier URL): overlay.
      var overlay = el("div", "pn-gr-overlay");
      var close = button("Cerrar ✕", "pn-gr-btn pn-gr-btn--ghost pn-gr-close", function () {
        overlay.remove();
        var p = params();
        ["lista", "panel", "editar", "nueva", "crear"].forEach(function (k) { p.delete(k); });
        var q = p.toString();
        window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : ""));
      });
      add(overlay, close, root);
      document.body.appendChild(overlay);
    }
    return root;
  }

  function screen() {
    var r = ensureRoot();
    r.innerHTML = "";
    return r;
  }

  function loading(text) {
    add(screen(), el("p", "pn-gr-muted", text || "Cargando…"));
  }

  function showError(err) {
    var r = screen();
    add(r, el("h2", null, "Uy, algo salió mal"), el("p", null, err.message || String(err)),
      button("Volver al inicio", "pn-gr-btn pn-gr-btn--ghost", function () { go(""); }));
  }

  // --- vistas -------------------------------------------------------------------

  function renderHome() {
    var r = screen();
    add(r, el("h2", null, (CFG.texts && CFG.texts.title) || "Lista de regalos"));
    add(r, el("p", "pn-gr-muted", (CFG.texts && CFG.texts.intro) ||
      "Armá tu lista con los productos que te gustan y compartila con tus invitados. Ellos eligen el regalo y lo pagan online."));

    var cards = el("div", "pn-gr-cards");
    var create = el("div", "pn-gr-card");
    add(create, el("h3", null, "Tengo un evento"),
      el("p", "pn-gr-muted", "Creá tu lista en un minuto y compartila con tus invitados."),
      button("Crear mi lista", "pn-gr-btn pn-gr-btn--block", function () { go("crear"); }));
    if (memory.keys.length) {
      var mine = button(memory.keys.length > 1 ? "Ver mis listas" : "Ir a mi lista", "pn-gr-btn pn-gr-btn--ghost pn-gr-btn--block", function () { go("panel"); });
      mine.style.marginTop = "8px";
      add(create, mine);
    }
    cards.appendChild(create);

    var guest = el("div", "pn-gr-card");
    add(guest, el("h3", null, "Soy invitado"),
      el("p", "pn-gr-muted", "Entrá con el link o el QR que te pasaron para ver la lista y elegir tu regalo."));
    cards.appendChild(guest);
    r.appendChild(cards);
  }

  function field(label, type, value, tag) {
    var wrap = el("label", "pn-gr-field");
    var input = document.createElement(tag || "input");
    if (!tag) input.type = type;
    input.value = value == null ? "" : value;
    add(wrap, el("span", null, label), input);
    return { wrap: wrap, input: input };
  }

  function selectField(label, options, value) {
    var wrap = el("label", "pn-gr-field");
    var select = document.createElement("select");
    Object.keys(options).forEach(function (k) {
      var o = el("option", null, options[k]);
      o.value = k;
      select.appendChild(o);
    });
    select.value = value;
    add(wrap, el("span", null, label), select);
    return { wrap: wrap, input: select };
  }

  // Achica la foto en el navegador antes de subirla (las del celular pesan MB).
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = function () { reject(new Error("No pudimos leer la foto.")); };
      img.src = URL.createObjectURL(file);
    });
  }

  function uploadCover(file) {
    return resizeImage(file).then(function (dataUrl) {
      return fetch(API + "/api/upload-image-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: STORE, fileName: "portada.jpg", fileData: dataUrl, folder: "gift-registry" }),
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.success || !res.url) throw new Error("No pudimos subir la foto.");
        return res.url;
      });
    });
  }

  // list + key: edicion. Sin list: alta (no pide login: el link de edicion
  // sale en la respuesta).
  function renderListForm(list, key) {
    var editing = !!list;
    var allowedModes = CFG.allowedModes && CFG.allowedModes.length ? CFG.allowedModes : Object.keys(MODES);
    var src = list || { eventType: "wedding", deliveryMode: allowedModes[0], owners: [], address: {} };
    var mine = (src.owners || [])[0] || { name: "", email: "" };
    var partner = (src.owners || [])[1] || { name: "", email: "" };
    var address = src.address || {};
    var cover = src.coverImage || "";

    var r = screen();
    add(r, el("h2", null, editing ? "Editar lista" : "Creá tu lista"));
    if (!editing) add(r, el("p", "pn-gr-muted", "Después vas a poder sumar productos desde cualquier ficha de la tienda."));

    var form = el("div", "pn-gr-form");
    var event = selectField("Evento", EVENTS, src.eventType || "wedding");
    var date = field("Fecha", "date", src.eventDate || "");
    var title = field("Nombre de la lista", "text", src.title || "");
    title.input.placeholder = "Ej: Sofi y Juan";
    title.wrap.classList.add("pn-gr-full");
    var myName = field("Tu nombre", "text", mine.name);
    var myEmail = field("Tu email (te mandamos el link para editar la lista)", "email", mine.email);
    myEmail.input.autocomplete = "email";
    var partnerName = field("Nombre de tu pareja (opcional)", "text", partner.name);
    var message = field("Mensaje para los invitados (opcional)", null, src.message || "", "textarea");
    message.input.rows = 3;
    message.input.maxLength = 500;
    message.wrap.classList.add("pn-gr-full");

    var coverWrap = el("div", "pn-gr-field pn-gr-full");
    var coverPreview = el("div", "pn-gr-cover");
    coverPreview.style.height = "140px";
    bg(coverPreview, cover);
    var coverInput = document.createElement("input");
    coverInput.type = "file";
    coverInput.accept = "image/*";
    var coverStatus = el("span", "pn-gr-muted", "");
    coverInput.addEventListener("change", function () {
      var file = coverInput.files && coverInput.files[0];
      if (!file) return;
      coverStatus.textContent = "Subiendo foto…";
      saveBtn.disabled = true;
      uploadCover(file).then(function (url) {
        cover = url;
        bg(coverPreview, url);
        coverStatus.textContent = "";
      }).catch(function (e) { coverStatus.textContent = e.message; })
        .then(function () { saveBtn.disabled = false; });
    });
    add(coverWrap, el("span", null, "Foto de portada (opcional)"), coverPreview, coverInput, coverStatus);

    var modesWrap = el("div", "pn-gr-field pn-gr-full");
    var modes = el("div", "pn-gr-modes");
    var mode = src.deliveryMode;
    var addressBox = el("div", "pn-gr-form pn-gr-full");
    allowedModes.forEach(function (id) {
      var opt = el("label", "pn-gr-mode" + (mode === id ? " is-on" : ""));
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "pn-gr-mode";
      radio.checked = mode === id;
      radio.addEventListener("change", function () {
        mode = id;
        var all = modes.querySelectorAll(".pn-gr-mode");
        for (var i = 0; i < all.length; i++) all[i].classList.remove("is-on");
        opt.classList.add("is-on");
        addressBox.style.display = mode === "couple_address" ? "" : "none";
      });
      var text = el("div");
      add(text, el("strong", null, MODES[id].label), el("small", null, MODES[id].hint));
      add(opt, radio, text);
      modes.appendChild(opt);
    });
    add(modesWrap, el("span", null, "¿Cómo reciben los regalos?"), modes);

    var addr = {
      address: field("Calle", "text", address.address),
      number: field("Número", "text", address.number),
      floor: field("Piso / depto (opcional)", "text", address.floor),
      locality: field("Barrio (opcional)", "text", address.locality),
      city: field("Ciudad", "text", address.city),
      province: field("Provincia", "text", address.province),
      zipcode: field("Código postal", "text", address.zipcode),
    };
    Object.keys(addr).forEach(function (k) { addressBox.appendChild(addr[k].wrap); });
    addressBox.style.display = mode === "couple_address" ? "" : "none";

    var error = el("p", "pn-gr-error pn-gr-full");
    var actions = el("div", "pn-gr-actions pn-gr-full");
    var saveBtn = button(editing ? "Guardar cambios" : "Crear lista", "pn-gr-btn", function () {
      error.textContent = "";
      var owners = [{ name: myName.input.value.trim(), email: myEmail.input.value.trim() }];
      if (partnerName.input.value.trim() || partner.email) owners.push({ name: partnerName.input.value.trim(), email: partner.email || "" });
      var payload = {
        title: title.input.value.trim(),
        eventType: event.input.value,
        eventDate: date.input.value,
        message: message.input.value.trim(),
        coverImage: cover,
        deliveryMode: mode,
        owners: owners,
        address: mode === "couple_address" ? Object.keys(addr).reduce(function (a, k) { a[k] = addr[k].input.value.trim(); return a; }, {}) : null,
      };
      saveBtn.disabled = true;
      var p = editing
        ? api("PATCH", "/api/gr/lists/" + list.id, { list: payload }, key).then(function () { go(editQuery(key)); })
        : api("POST", "/api/gr/lists", { list: payload }).then(function (res) {
          rememberKey(res.editKey);
          go(editQuery(res.editKey) + "&nueva=" + (res.emailed ? "mail" : "1"));
        });
      p.catch(function (e) { error.textContent = e.message; saveBtn.disabled = false; });
    });
    add(actions, saveBtn, button("Cancelar", "pn-gr-btn pn-gr-btn--ghost", function () { go(editing ? editQuery(key) : ""); }));

    add(form, event.wrap, date.wrap, title.wrap, myName.wrap, myEmail.wrap, partnerName.wrap,
      message.wrap, coverWrap, modesWrap, addressBox, error, actions);
    r.appendChild(form);
  }

  function publicUrl(list) {
    return window.location.origin + CFG.pagePath + "?lista=" + encodeURIComponent(list.slug);
  }
  function editQuery(key) { return "editar=" + encodeURIComponent(key); }
  function editLink(key) { return window.location.origin + pageUrl(editQuery(key)); }

  // Input de solo lectura con boton de copiar.
  function copyField(value, label) {
    var wrap = el("div", "pn-gr-share");
    var input = document.createElement("input");
    input.readOnly = true;
    input.value = value;
    var btn = button(label, "pn-gr-btn", function () {
      input.select();
      var done = function () { btn.textContent = "¡Copiado!"; setTimeout(function () { btn.textContent = label; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(value).then(done, done);
      else { document.execCommand("copy"); done(); }
    });
    add(wrap, input, btn);
    return wrap;
  }

  function saveBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  function downloadCsv(list, key) {
    fetch(API + "/api/gr/lists/" + list.id + "/export.csv?store=" + STORE, { headers: { Authorization: "Bearer " + key } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
      .then(function (blob) { saveBlob(blob, "regalos-" + list.slug + ".csv"); })
      .catch(function () { window.console && console.warn("[Lista de regalos] no se pudo exportar"); });
  }

  // --- compartir: link, WhatsApp, QR y placas ---------------------------------

  var QR_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  var qrLoading = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLoading) {
      qrLoading = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = QR_SRC;
        s.async = true;
        s.onload = function () { if (window.qrcode) resolve(window.qrcode); else reject(new Error("No pudimos generar el QR.")); };
        s.onerror = function () { qrLoading = null; reject(new Error("No pudimos generar el QR. Revisá tu conexión.")); };
        document.head.appendChild(s);
      });
    }
    return qrLoading;
  }
  function makeQr(text) {
    return loadQr().then(function (lib) {
      var qr = lib(0, "M");
      qr.addData(text);
      qr.make();
      return qr;
    });
  }
  function drawQr(ctx, qr, x, y, size) {
    var n = qr.getModuleCount();
    var cell = size / n;
    ctx.fillStyle = "#1f1e1e";
    for (var row = 0; row < n; row++) {
      for (var col = 0; col < n; col++) {
        // +0.5 evita las lineas finas entre modulos al escalar
        if (qr.isDark(row, col)) ctx.fillRect(x + col * cell, y + row * cell, Math.ceil(cell + 0.5), Math.ceil(cell + 0.5));
      }
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fontFamily() {
    var f = "";
    try { f = window.getComputedStyle(document.body).fontFamily || ""; } catch (_) { /* sin estilos */ }
    return (f ? f + ", " : "") + "Helvetica, Arial, sans-serif";
  }
  function wrapText(ctx, text, maxWidth, maxLines) {
    var words = String(text || "").split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    }
    return lines;
  }
  // Storage no tiene CORS: la portada pasa por el proxy para no "ensuciar" el canvas.
  function loadCover(url) {
    if (!url) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = API + "/api/gr/cover?url=" + encodeURIComponent(absUrl(url));
    });
  }
  function drawCover(ctx, img, x, y, w, h) {
    var scale = Math.max(w / img.width, h / img.height);
    var sw = w / scale;
    var sh = h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  function shortUrl(list) {
    return window.location.host.replace(/^www\./, "") + CFG.pagePath + "?lista=" + list.slug;
  }

  // Placa vertical: foto arriba, datos del evento y QR abajo.
  function drawPlaca(list, w, h, qr, img) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    var font = fontFamily();
    var ink = "#353434";
    var soft = "#8a8580";
    var pad = Math.round(w * 0.08);
    ctx.fillStyle = "#faf8f5";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";

    // De abajo hacia arriba: link, QR, leyenda.
    var linkSize = Math.round(w * 0.026);
    var linkY = h - pad;
    var qrSize = Math.round(w * 0.38);
    var qrPad = Math.round(w * 0.035);
    var qrBox = qrSize + qrPad * 2;
    var qrTop = linkY - linkSize * 2 - qrBox;
    var captionSize = Math.round(w * 0.034);
    var captionY = qrTop - captionSize * 1.4;

    // Bloque de texto del evento.
    var titleSize = Math.round(w * 0.072);
    ctx.font = "600 " + titleSize + "px " + font;
    var titleLines = wrapText(ctx, list.title, w - pad * 2, 3);
    var eventSize = Math.round(w * 0.026);
    var dateSize = Math.round(w * 0.034);
    var textH = eventSize * 2.2 + titleLines.length * titleSize * 1.18 + dateSize * 1.8;
    var gap = Math.round(h * 0.045);
    var room = captionY - captionSize - gap * 2 - textH;
    var photoH = img ? Math.min(Math.round(h * 0.4), room) : 0;
    if (photoH < h * 0.15) photoH = 0;
    if (photoH) drawCover(ctx, img, 0, 0, w, photoH);

    // Centrado en el espacio libre entre la foto y la leyenda del QR.
    var y = photoH + Math.max(gap, (captionY - captionSize - gap - photoH - textH) / 2);
    ctx.textBaseline = "top";
    ctx.fillStyle = soft;
    ctx.font = "600 " + eventSize + "px " + font;
    if ("letterSpacing" in ctx) ctx.letterSpacing = Math.round(eventSize * 0.25) + "px";
    ctx.fillText((EVENTS[list.eventType] || "Lista de regalos").toUpperCase(), w / 2, y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    y += eventSize * 2.2;
    ctx.fillStyle = ink;
    ctx.font = "600 " + titleSize + "px " + font;
    titleLines.forEach(function (line) { ctx.fillText(line, w / 2, y); y += titleSize * 1.18; });
    y += dateSize * 0.5;
    ctx.fillStyle = soft;
    ctx.font = "400 " + dateSize + "px " + font;
    ctx.fillText(formatDate(list.eventDate), w / 2, y);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = ink;
    ctx.font = "600 " + captionSize + "px " + font;
    ctx.fillText("Nuestra lista de regalos", w / 2, captionY);

    var qrX = (w - qrBox) / 2;
    ctx.fillStyle = "#fff";
    roundRect(ctx, qrX, qrTop, qrBox, qrBox, Math.round(w * 0.02));
    ctx.fill();
    ctx.strokeStyle = "#e7e2db";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawQr(ctx, qr, qrX + qrPad, qrTop + qrPad, qrSize);

    // El link puede ser largo (dominio + slug): se achica hasta que entre.
    var link = shortUrl(list);
    ctx.fillStyle = soft;
    ctx.font = "400 " + linkSize + "px " + font;
    while (linkSize > 12 && ctx.measureText(link).width > w - pad * 2) {
      linkSize -= 1;
      ctx.font = "400 " + linkSize + "px " + font;
    }
    ctx.fillText(link, w / 2, linkY);
    return c;
  }

  function drawQrOnly(qr) {
    var size = 1000;
    var margin = 80;
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    drawQr(ctx, qr, margin, margin, size - margin * 2);
    return c;
  }

  function canvasToPng(canvas, name) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error("No pudimos armar la imagen."));
          saveBlob(blob, name);
          resolve();
        }, "image/png");
      } catch (e) {
        reject(new Error("No pudimos armar la imagen."));
      }
    });
  }

  function renderShare(r, list) {
    var url = publicUrl(list);
    add(r, el("h3", null, "Compartí tu lista"), copyField(url, "Copiar link"));

    var actions = el("div", "pn-gr-actions");
    actions.style.marginTop = "10px";
    var wa = el("a", "pn-gr-btn pn-gr-btn--ghost", "Compartir por WhatsApp");
    wa.href = "https://wa.me/?text=" + encodeURIComponent(list.title + " — nuestra lista de regalos: " + url);
    wa.target = "_blank";
    wa.rel = "noopener";
    var error = el("p", "pn-gr-error");

    // Cada boton arma su imagen al tocarlo (el QR se carga recien ahi).
    var job = function (btn, label, build) {
      return function () {
        error.textContent = "";
        btn.disabled = true;
        btn.textContent = "Armando…";
        build().catch(function (e) { error.textContent = e.message; })
          .then(function () { btn.disabled = false; btn.textContent = label; });
      };
    };
    var fontsReady = function () { return (document.fonts && document.fonts.ready) || Promise.resolve(); };
    var placa = function (w, h, name) {
      return function () {
        return Promise.all([makeQr(url), loadCover(list.coverImage), fontsReady()]).then(function (res) {
          return canvasToPng(drawPlaca(list, w, h, res[0], res[1]), name);
        });
      };
    };
    var qrBtn = button("Descargar QR", "pn-gr-btn pn-gr-btn--ghost");
    qrBtn.addEventListener("click", job(qrBtn, "Descargar QR", function () {
      return makeQr(url).then(function (qr) { return canvasToPng(drawQrOnly(qr), "qr-" + list.slug + ".png"); });
    }));
    var storyBtn = button("Placa para historia", "pn-gr-btn pn-gr-btn--ghost");
    storyBtn.addEventListener("click", job(storyBtn, "Placa para historia", placa(1080, 1920, "historia-" + list.slug + ".png")));
    var cardBtn = button("Tarjeta para imprimir", "pn-gr-btn pn-gr-btn--ghost");
    cardBtn.addEventListener("click", job(cardBtn, "Tarjeta para imprimir", placa(1200, 1800, "tarjeta-" + list.slug + ".png")));
    add(actions, wa, qrBtn, storyBtn, cardBtn);
    add(r, actions, el("p", "pn-gr-muted", "La placa para historia es para Instagram o WhatsApp. La tarjeta mide 10×15 cm para imprimir y sumar a la invitación."), error);
  }

  // fresh: "1" o "mail" recien creada (mail = tambien se mando por email).
  function renderPrivateLink(r, key, fresh) {
    var box = el("div", "pn-gr-private" + (fresh ? " is-new" : ""));
    add(box, el("h3", null, fresh ? "¡Tu lista está creada! Guardá tu link privado" : "Tu link privado para editar"),
      el("p", "pn-gr-muted", "Con este link volvés a editar tu lista desde cualquier celu o compu. No se lo pases a los invitados: para ellos está el link de abajo." +
        (fresh === "mail" ? " También te lo mandamos por email." : "")),
      copyField(editLink(key), "Copiar"));
    r.appendChild(box);
  }

  function renderPanel(list, key, fresh) {
    var r = screen();
    if (list.coverImage) { var c = el("div", "pn-gr-cover"); bg(c, list.coverImage); r.appendChild(c); }

    var head = el("div", "pn-gr-head");
    var info = el("div");
    add(info, el("h2", null, list.title));
    add(info, el("span", "pn-gr-chip", EVENTS[list.eventType] || "Evento"), el("span", "pn-gr-chip", formatDate(list.eventDate)),
      el("span", "pn-gr-chip", (MODES[list.deliveryMode] || {}).label), list.status !== "active" ? el("span", "pn-gr-chip", "Cerrada") : null);
    var actions = el("div", "pn-gr-actions");
    add(actions, button("Editar datos", "pn-gr-btn pn-gr-btn--ghost", function () { renderListForm(list, key); }));
    if (memory.keys.length > 1) add(actions, button("Mis listas", "pn-gr-btn pn-gr-btn--ghost", function () { go("panel"); }));
    add(head, info, actions);
    r.appendChild(head);
    if (list.message) add(r, el("p", "pn-gr-muted", list.message));

    renderPrivateLink(r, key, fresh);
    renderShare(r, list);

    // Productos
    var itemsHead = el("div", "pn-gr-head");
    add(itemsHead, el("h3", null, "Productos de tu lista (" + list.items.length + ")"));
    var addMore = el("a", "pn-gr-btn pn-gr-btn--ghost", "+ Seguir agregando productos");
    addMore.href = "/productos/";
    addMore.style.marginTop = "20px";
    add(itemsHead, addMore);
    r.appendChild(itemsHead);

    var error = el("p", "pn-gr-error");
    if (!list.items.length) {
      add(r, el("p", "pn-gr-muted", "Todavía no agregaste productos. Entrá a cualquier producto de la tienda y tocá \"Agregar a mi lista de regalos\"."));
    }
    var items = el("div", "pn-gr-items");
    list.items.forEach(function (item) {
      var row = el("div", "pn-gr-item");
      var thumb = el("div", "pn-gr-thumb");
      bg(thumb, item.image);
      var data = el("div", "pn-gr-info");
      add(data, el("strong", null, item.name), el("span", "pn-gr-muted", money(item.price) + " · " + item.gifted + " de " + item.quantity + " regalados"));
      var bar = el("div", "pn-gr-bar");
      var fill = el("span");
      fill.style.width = Math.min(100, (item.gifted / Math.max(1, item.quantity)) * 100) + "%";
      add(bar, fill);
      add(data, bar);

      var qty = el("div", "pn-gr-qty");
      var change = function (n) {
        error.textContent = "";
        var p = n === 0
          ? api("DELETE", "/api/gr/lists/" + list.id + "/items/" + item.itemId, null, key)
          : api("PATCH", "/api/gr/lists/" + list.id + "/items/" + item.itemId, { quantity: n }, key);
        p.then(function (res) { renderPanel(res.list, key); })
          .catch(function (e) { error.textContent = e.message; });
      };
      if (list.status === "active") {
        add(qty, button("−", "", function () { change(item.quantity - 1); }), el("span", null, String(item.quantity)),
          button("+", "", function () { change(item.quantity + 1); }));
        if (!item.gifted) {
          var remove = button("Quitar", "pn-gr-link", function () { change(0); });
          remove.style.marginLeft = "6px";
          add(qty, remove);
        }
      }
      add(row, thumb, data, qty);
      items.appendChild(row);
    });
    add(r, items, error);

    // Regalos recibidos
    add(r, el("h3", null, "Regalos recibidos (" + list.gifts.length + ")"));
    if (!list.gifts.length) add(r, el("p", "pn-gr-muted", "Cuando un invitado pague un regalo lo vas a ver acá, con su mensaje."));
    var names = {};
    list.items.forEach(function (i) { names[i.itemId] = i.name; });
    list.gifts.forEach(function (g) {
      var row = el("div", "pn-gr-gift");
      add(row, el("strong", null, (g.guestName || "Un invitado") + " te regaló " + (names[g.itemId] || "un producto") + (g.quantity > 1 ? " x" + g.quantity : "")));
      if (g.message) add(row, el("em", null, "“" + g.message + "”"));
      r.appendChild(row);
    });
    if (list.gifts.length) {
      var exp = button("Descargar lista de regalos (Excel)", "pn-gr-btn pn-gr-btn--ghost", function () { downloadCsv(list, key); });
      exp.style.marginTop = "12px";
      r.appendChild(exp);
    }

    var foot = el("p", "pn-gr-muted");
    foot.style.marginTop = "32px";
    add(foot, button("Olvidar esta lista en este dispositivo", "pn-gr-link", function () { forgetKey(key); go(""); }));
    r.appendChild(foot);
  }

  function loadManaged(key) {
    return api("GET", "/api/gr/manage", null, key).then(function (res) { return { key: key, list: res.list }; });
  }

  // Listas de los links guardados en este navegador (los invalidos se olvidan).
  function loadAllManaged() {
    return Promise.all(memory.keys.map(function (k) {
      return loadManaged(k).catch(function () { return null; });
    })).then(function (all) { return all.filter(Boolean); });
  }

  function renderMyLists(entries) {
    var r = screen();
    add(r, el("h2", null, "Mis listas"));
    var cards = el("div", "pn-gr-cards");
    entries.forEach(function (e) {
      var card = el("div", "pn-gr-card");
      add(card, el("h3", null, e.list.title), el("p", "pn-gr-muted", (EVENTS[e.list.eventType] || "") + " · " + formatDate(e.list.eventDate)),
        button("Ver lista", "pn-gr-btn pn-gr-btn--block", function () { go(editQuery(e.key)); }));
      cards.appendChild(card);
    });
    r.appendChild(cards);
    var n = button("+ Crear otra lista", "pn-gr-btn pn-gr-btn--ghost", function () { go("crear"); });
    n.style.marginTop = "16px";
    r.appendChild(n);
  }

  function renderEditRoute(key, fresh) {
    loading();
    loadManaged(key).then(function (e) {
      rememberKey(key);
      // El aviso de "recien creada" no vuelve a salir si recargan.
      if (fresh) window.history.replaceState({}, "", pageUrl(editQuery(key)));
      renderPanel(e.list, key, fresh);
    }).catch(function (e) {
      var r = screen();
      add(r, el("h2", null, e.status === 401 ? "Link no válido" : "Uy, algo salió mal"),
        el("p", "pn-gr-muted", e.status === 401
          ? "Este link de edición no corresponde a ninguna lista. Revisá que esté completo o pedíselo a la tienda."
          : e.message),
        button("Volver al inicio", "pn-gr-btn pn-gr-btn--ghost", function () { go(""); }));
    });
  }

  // ?panel: las listas guardadas en este navegador (o crear la primera).
  function renderMineRoute() {
    if (!memory.keys.length) return renderListForm(null);
    loading();
    loadAllManaged().then(function (entries) {
      if (!entries.length) return renderListForm(null);
      if (entries.length === 1) return replace(editQuery(entries[0].key));
      renderMyLists(entries);
    }).catch(showError);
  }

  // --- invitados -----------------------------------------------------------------

  var GUEST_NOTICE = {
    couple_address: function (list) {
      return "El regalo se envía a " + list.title + ". En el checkout no cambies la dirección de entrega; en facturación podés cargar tus datos.";
    },
    store_pickup: function () { return "Al pagar elegí retiro en el local: la tienda les entrega todos los regalos juntos."; },
    guest_choice: function () { return "Al pagar elegí cómo recibirlo: envío o retiro en el local."; },
  };

  function renderGuestRoute(slug) {
    loading();
    api("GET", "/api/gr/public/" + encodeURIComponent(slug))
      .then(function (res) { renderGuest(res.list); })
      .catch(function (e) {
        var r = screen();
        add(r, el("h2", null, "Lista no disponible"), el("p", "pn-gr-muted", e.message),
          button("Ir al inicio", "pn-gr-btn pn-gr-btn--ghost", function () { go(""); }));
      });
  }

  function renderGuest(list) {
    var r = screen();
    if (list.coverImage) { var c = el("div", "pn-gr-cover"); bg(c, list.coverImage); r.appendChild(c); }
    add(r, el("h2", null, list.title));
    add(r, el("span", "pn-gr-chip", EVENTS[list.eventType] || "Evento"), el("span", "pn-gr-chip", formatDate(list.eventDate)));
    if (list.message) add(r, el("p", null, list.message));
    var notice = el("p", "pn-gr-notice", (GUEST_NOTICE[list.deliveryMode] || GUEST_NOTICE.guest_choice)(list));
    r.appendChild(notice);

    var grid = el("div", "pn-gr-grid");
    if (!list.items.length) add(r, el("p", "pn-gr-muted", "Todavía no hay regalos en esta lista."));
    list.items.forEach(function (item) {
      var done = item.available === 0;
      var card = el("div", "pn-gr-gcard" + (done ? " is-done" : ""));
      var img = el("div", "pn-gr-gimg");
      bg(img, item.image);
      var body = el("div", "pn-gr-gbody");
      add(body, el("strong", null, item.name), el("span", "pn-gr-gprice", money(item.price)));
      if (!done && item.quantity > 1) add(body, el("span", "pn-gr-muted", "Quedan " + item.available + " de " + item.quantity));
      add(body, done
        ? el("span", "pn-gr-done", "¡Ya lo regalaron!")
        : button("Lo regalo yo", "pn-gr-btn pn-gr-btn--block", function () { openGiftModal(list, item); }));
      add(card, img, body);
      grid.appendChild(card);
    });
    r.appendChild(grid);
  }

  function addToCart(res, slug) {
    var body = "add_to_cart=" + encodeURIComponent(res.productId) +
      "&variant_id=" + encodeURIComponent(res.variantId) +
      "&quantity=" + encodeURIComponent(res.quantity) +
      "&" + encodeURIComponent("properties[lista]") + "=" + encodeURIComponent(slug) +
      "&" + encodeURIComponent("properties[regalo]") + "=" + encodeURIComponent(res.giftId);
    return fetch("/comprar/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
      body: body,
    }).then(function (r) { return r.json(); }).then(function (json) {
      if (!json || json.success === false) throw new Error("No pudimos agregarlo al carrito. Probá de nuevo.");
    });
  }

  function openGiftModal(list, item) {
    var overlay = el("div", "pn-gr-modal-bg");
    var modal = el("div", "pn-gr-modal pn-gr");
    var close = function () { overlay.remove(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    add(modal, el("h3", null, "Vas a regalar: " + item.name));
    var form = el("div", "pn-gr-form");
    var name = field("Tu nombre", "text", "");
    var email = field("Tu email", "email", "");
    var qty = item.available > 1 ? field("Cantidad (quedan " + item.available + ")", "number", "1") : null;
    if (qty) { qty.input.min = 1; qty.input.max = item.available; }
    var msg = field("Mensaje para " + list.title + " (opcional)", null, "", "textarea");
    msg.input.rows = 3;
    msg.input.maxLength = 500;
    [name, email, msg].forEach(function (f) { f.wrap.classList.add("pn-gr-full"); });
    var error = el("p", "pn-gr-error pn-gr-full");
    var hours = el("p", "pn-gr-muted pn-gr-full",
      "Te lo reservamos mientras pagás. Si no completás el pago, en unas horas vuelve a quedar disponible para otro invitado.");

    var go2 = button(list.deliveryMode === "guest_choice" ? "Agregar al carrito y pagar" : "Ir a pagar", "pn-gr-btn", function () {
      error.textContent = "";
      go2.disabled = true;
      go2.textContent = "Preparando…";
      api("POST", "/api/gr/public/" + encodeURIComponent(list.slug) + "/reserve", {
        itemId: item.itemId,
        guestName: name.input.value.trim(),
        guestEmail: email.input.value.trim(),
        message: msg.input.value.trim(),
        quantity: qty ? parseInt(qty.input.value, 10) || 1 : 1,
      }).then(function (res) {
        if (res.mode === "draft") { window.location.href = res.checkoutUrl; return; }
        return addToCart(res, list.slug).then(function () { window.location.href = "/comprar/"; });
      }).catch(function (e) {
        error.textContent = e.message;
        go2.disabled = false;
        go2.textContent = "Probar de nuevo";
        if (e.status === 409) renderGuestRoute(list.slug);
      });
    });
    var actions = el("div", "pn-gr-actions pn-gr-full");
    add(actions, go2, button("Cancelar", "pn-gr-btn pn-gr-btn--ghost", close));
    add(form, name.wrap, email.wrap, qty && qty.wrap, msg.wrap, hours, error, actions);
    add(modal, el("p", "pn-gr-notice", (GUEST_NOTICE[list.deliveryMode] || GUEST_NOTICE.guest_choice)(list)), form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    name.input.focus();
  }

  function route() {
    var p = params();
    if (p.get("lista")) return renderGuestRoute(p.get("lista"));
    if (p.get("editar")) return renderEditRoute(p.get("editar"), p.get("nueva"));
    if (p.has("crear")) return renderListForm(null);
    if (p.has("panel")) return renderMineRoute();
    if (window.location.pathname === CFG.pagePath) return renderHome();
  }

  // --- boton en la ficha de producto --------------------------------------------

  // Algunas fichas tienen mas de un form de compra (ej. barra fija): se usa
  // el que tiene el producto y los selects de variante.
  function productForm() {
    var forms = document.querySelectorAll(".js-product-form, form[action*='/comprar']");
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].querySelector("[name='add_to_cart']") && forms[i].querySelector("[name^='variation']")) return forms[i];
    }
    for (var k = 0; k < forms.length; k++) if (forms[k].querySelector("[name='add_to_cart']")) return forms[k];
    return forms[0] || null;
  }

  function selectedVariant() {
    var variants = (window.LS && window.LS.variants) || [];
    if (variants.length <= 1) return variants[0];
    var form = productForm();
    var chosen = [];
    for (var i = 0; i < 3; i++) {
      var s = form && form.querySelector("[name='variation[" + i + "]']");
      chosen.push(s ? s.value : null);
    }
    return variants.filter(function (v) {
      return [0, 1, 2].every(function (i) { return chosen[i] == null || v["option" + i] == null || String(v["option" + i]) === String(chosen[i]); });
    })[0] || variants[0];
  }

  function mountPdpButton() {
    var product = window.LS && window.LS.product;
    if (!product || !memory.keys.length || document.querySelector(".pn-gr-pdp")) return;
    var form = productForm();
    if (!form || !form.parentNode) return;

    loadAllManaged().then(function (entries) {
      var lists = entries.filter(function (e) { return e.list.status === "active"; });
      if (!lists.length) return;
      if (!document.getElementById("pn-gr-styles")) {
        var style = document.createElement("style");
        style.id = "pn-gr-styles";
        style.textContent = CFG.styles;
        document.head.appendChild(style);
      }
      var box = el("div", "pn-gr-pdp");
      var select = null;
      if (lists.length > 1) {
        select = document.createElement("select");
        lists.forEach(function (e, i) { var o = el("option", null, e.list.title); o.value = String(i); select.appendChild(o); });
        box.appendChild(select);
      }
      var msg = el("p", "pn-gr-pdp-ok");
      var btn = button("♡ Agregar a mi lista de regalos", "pn-gr-btn pn-gr-btn--ghost pn-gr-btn--block", function () {
        var v = selectedVariant();
        if (!v) return;
        var qtyInput = form.querySelector(".js-quantity-input, input[name='quantity']");
        var quantity = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);
        var options = [v.option0, v.option1, v.option2].filter(Boolean).join(" / ");
        var target = lists[select ? Number(select.value) : 0];
        btn.disabled = true;
        msg.textContent = "";
        api("POST", "/api/gr/lists/" + target.list.id + "/items", {
          item: {
            productId: product.id,
            variantId: v.id,
            name: product.name + (options ? " (" + options + ")" : ""),
            image: absUrl(v.image_url),
            price: v.price_number,
            quantity: quantity,
          },
        }, target.key).then(function () {
          msg.style.color = "";
          msg.textContent = "Agregado a tu lista ✓";
          var link = el("a", null, "Ver mi lista");
          link.href = pageUrl(editQuery(target.key));
          msg.appendChild(link);
        }).catch(function (e) {
          msg.style.color = "#b3261e";
          msg.textContent = e.message;
        }).then(function () { btn.disabled = false; });
      });
      add(box, btn, msg);
      form.parentNode.insertBefore(box, form.nextSibling);
    }).catch(function () { /* sin listas validas: no se muestra */ });
  }

  // --- arranque ----------------------------------------------------------------

  function start() {
    var p = params();
    if (window.location.pathname === CFG.pagePath || p.get("lista") || p.get("editar") || p.has("panel") || p.has("crear")) route();
    else mountPdpButton();
  }
  window.addEventListener("popstate", function () {
    if (root) route();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}

function buildStorefrontScript({ store, api, config }) {
  const cfg = {
    store: String(store),
    api,
    pagePath: config.pagePath,
    allowedModes: config.allowedModes || [],
    texts: config.texts || {},
    styles: STYLES,
  };
  // JSON.stringify no escapa "</script>": se escapa "<" por si el JS se inlinea.
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return `/* Lista de regalos - tienda ${cfg.store} */\n(${clientMain.toString()})(${json});\n`;
}

module.exports = { buildStorefrontScript, clientMain, STYLES };
