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
  "@media (max-width: 640px) { .pn-gr-form { grid-template-columns: 1fr !important; } .pn-gr h2 { font-size: 22px !important; } .pn-gr-cover { height: 160px !important; } }",
].join("");

// ---------------------------------------------------------------------------
// Codigo del navegador (se serializa: no puede usar nada de este modulo)
// ---------------------------------------------------------------------------

function clientMain(CFG) {
  if (window.__pnGiftRegistry) return;
  window.__pnGiftRegistry = true;

  var API = CFG.api;
  var STORE = CFG.store;
  var TOKEN_KEY = "pn_gr_token_" + STORE;
  var EMAIL_KEY = "pn_gr_email_" + STORE;

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
    } catch (_) { /* sin storage: la sesion dura lo que la pagina */ }
    return null;
  }
  var memory = { token: store(TOKEN_KEY), email: store(EMAIL_KEY) };
  function setSession(token, email) {
    memory.token = token; memory.email = email;
    store(TOKEN_KEY, token); store(EMAIL_KEY, email);
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

  function api(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    if (memory.token) headers.Authorization = "Bearer " + memory.token;
    var url = API + path + (path.indexOf("?") > -1 ? "&" : "?") + "store=" + STORE;
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(Object.assign({ store: STORE }, body)) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (r.status === 401) setSession(null, null);
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
        var p = params(); p.delete("lista"); p.delete("panel");
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
      el("p", "pn-gr-muted", "Creá tu lista o entrá a la que ya tenés."),
      button(memory.token ? "Ir a mi lista" : "Crear o entrar a mi lista", "pn-gr-btn pn-gr-btn--block", function () { go("panel"); }));
    cards.appendChild(create);

    var guest = el("div", "pn-gr-card");
    add(guest, el("h3", null, "Soy invitado"),
      el("p", "pn-gr-muted", "Entrá con el link o el QR que te pasaron los anfitriones."));
    cards.appendChild(guest);
    r.appendChild(cards);
  }

  function renderLogin(next) {
    var r = screen();
    add(r, el("h2", null, "Entrá a tu lista"),
      el("p", "pn-gr-muted", "Te mandamos un código por email. No hace falta contraseña."));

    var card = el("div", "pn-gr-card");
    var form = el("div", "pn-gr-form");
    var emailField = field("Email", "email", memory.email || "");
    emailField.input.autocomplete = "email";
    var codeField = field("Código de 6 dígitos", "text", "");
    codeField.input.inputMode = "numeric";
    codeField.input.maxLength = 6;
    codeField.wrap.style.display = "none";
    emailField.wrap.classList.add("pn-gr-full");
    codeField.wrap.classList.add("pn-gr-full");
    var error = el("p", "pn-gr-error pn-gr-full");
    var step = "email";

    var submit = button("Enviarme el código", "pn-gr-btn pn-gr-btn--block pn-gr-full", function () {
      error.textContent = "";
      submit.disabled = true;
      var email = emailField.input.value.trim().toLowerCase();
      var p = step === "email"
        ? api("POST", "/api/gr/auth/request-code", { email: email }).then(function () {
          step = "code";
          emailField.input.disabled = true;
          codeField.wrap.style.display = "";
          codeField.input.focus();
          submit.textContent = "Entrar";
          hint.textContent = "Revisá tu email (y la carpeta de spam). El código vence en 10 minutos.";
        })
        : api("POST", "/api/gr/auth/verify", { email: email, code: codeField.input.value.trim() }).then(function (res) {
          setSession(res.token, res.email);
          next();
        });
      p.catch(function (e) { error.textContent = e.message; }).then(function () { submit.disabled = false; });
    });
    var hint = el("p", "pn-gr-muted pn-gr-full", "");
    var other = button("Usar otro email", "pn-gr-link pn-gr-full", function () { renderLogin(next); });

    add(form, emailField.wrap, codeField.wrap, submit, error, hint, other);
    [emailField.input, codeField.input].forEach(function (i) {
      i.addEventListener("keydown", function (e) { if (e.key === "Enter") submit.click(); });
    });
    add(card, form);
    r.appendChild(card);
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

  function renderListForm(me, list) {
    var editing = !!list;
    var src = list || { eventType: "wedding", deliveryMode: me.config.allowedModes[0], owners: [{ name: "", email: me.email }], address: {} };
    var mine = (src.owners || []).filter(function (o) { return o.email === me.email; })[0] || { name: "", email: me.email };
    var partner = (src.owners || []).filter(function (o) { return o.email !== me.email; })[0] || { name: "", email: "" };
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
    var partnerName = field("Nombre de tu pareja (opcional)", "text", partner.name);
    var partnerEmail = field("Email de tu pareja (opcional, también podrá editar)", "email", partner.email);
    partnerEmail.wrap.classList.add("pn-gr-full");
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
    me.config.allowedModes.forEach(function (id) {
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

    var publicCheck = el("label", "pn-gr-check pn-gr-full");
    var publicInput = document.createElement("input");
    publicInput.type = "checkbox";
    publicInput.checked = !!src.public;
    add(publicCheck, publicInput, el("span", null, "Que aparezca en el buscador de listas de la tienda"));

    var error = el("p", "pn-gr-error pn-gr-full");
    var actions = el("div", "pn-gr-actions pn-gr-full");
    var saveBtn = button(editing ? "Guardar cambios" : "Crear lista", "pn-gr-btn", function () {
      error.textContent = "";
      var owners = [{ name: myName.input.value.trim(), email: me.email }];
      if (partnerEmail.input.value.trim()) owners.push({ name: partnerName.input.value.trim(), email: partnerEmail.input.value.trim() });
      var payload = {
        title: title.input.value.trim(),
        eventType: event.input.value,
        eventDate: date.input.value,
        message: message.input.value.trim(),
        coverImage: cover,
        deliveryMode: mode,
        public: publicInput.checked,
        owners: owners,
        address: mode === "couple_address" ? Object.keys(addr).reduce(function (a, k) { a[k] = addr[k].input.value.trim(); return a; }, {}) : null,
      };
      saveBtn.disabled = true;
      var p = editing ? api("PATCH", "/api/gr/lists/" + list.id, { list: payload }) : api("POST", "/api/gr/lists", { list: payload });
      p.then(function (res) { go("panel&id=" + res.list.id); })
        .catch(function (e) { error.textContent = e.message; saveBtn.disabled = false; });
    });
    add(actions, saveBtn);
    if (editing || me.lists.length) add(actions, button("Cancelar", "pn-gr-btn pn-gr-btn--ghost", function () { go(editing ? "panel&id=" + list.id : "panel"); }));

    add(form, event.wrap, date.wrap, title.wrap, myName.wrap, partnerName.wrap, partnerEmail.wrap,
      message.wrap, coverWrap, modesWrap, addressBox, publicCheck, error, actions);
    r.appendChild(form);
  }

  function publicUrl(list) {
    return window.location.origin + CFG.pagePath + "?lista=" + encodeURIComponent(list.slug);
  }

  function downloadCsv(list) {
    fetch(API + "/api/gr/lists/" + list.id + "/export.csv?store=" + STORE, { headers: { Authorization: "Bearer " + memory.token } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
      .then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "regalos-" + list.slug + ".csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(function () { window.console && console.warn("[Lista de regalos] no se pudo exportar"); });
  }

  function renderPanel(me, list) {
    var r = screen();
    if (list.coverImage) { var c = el("div", "pn-gr-cover"); bg(c, list.coverImage); r.appendChild(c); }

    var head = el("div", "pn-gr-head");
    var info = el("div");
    add(info, el("h2", null, list.title));
    add(info, el("span", "pn-gr-chip", EVENTS[list.eventType] || "Evento"), el("span", "pn-gr-chip", formatDate(list.eventDate)),
      el("span", "pn-gr-chip", (MODES[list.deliveryMode] || {}).label), list.status !== "active" ? el("span", "pn-gr-chip", "Cerrada") : null);
    var actions = el("div", "pn-gr-actions");
    add(actions, button("Editar datos", "pn-gr-btn pn-gr-btn--ghost", function () { renderListForm(me, list); }));
    if (me.lists.length > 1) add(actions, button("Mis listas", "pn-gr-btn pn-gr-btn--ghost", function () { go("panel"); }));
    add(head, info, actions);
    r.appendChild(head);
    if (list.message) add(r, el("p", "pn-gr-muted", list.message));

    // Compartir (link simple; QR y placas en la etapa de compartir).
    add(r, el("h3", null, "Compartí tu lista"));
    var share = el("div", "pn-gr-share");
    var linkInput = document.createElement("input");
    linkInput.readOnly = true;
    linkInput.value = publicUrl(list);
    var copyBtn = button("Copiar link", "pn-gr-btn", function () {
      linkInput.select();
      var done = function () { copyBtn.textContent = "¡Copiado!"; setTimeout(function () { copyBtn.textContent = "Copiar link"; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(linkInput.value).then(done, done);
      else { document.execCommand("copy"); done(); }
    });
    add(share, linkInput, copyBtn);
    r.appendChild(share);

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
          ? api("DELETE", "/api/gr/lists/" + list.id + "/items/" + item.itemId)
          : api("PATCH", "/api/gr/lists/" + list.id + "/items/" + item.itemId, { quantity: n });
        p.then(function (res) { replaceList(me, res.list); renderPanel(me, res.list); })
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
      var exp = button("Descargar lista de regalos (Excel)", "pn-gr-btn pn-gr-btn--ghost", function () { downloadCsv(list); });
      exp.style.marginTop = "12px";
      r.appendChild(exp);
    }

    var foot = el("p", "pn-gr-muted");
    foot.style.marginTop = "32px";
    add(foot, document.createTextNode("Entraste como " + me.email + " · "),
      button("Salir", "pn-gr-link", function () { setSession(null, null); go(""); }));
    r.appendChild(foot);
  }

  function replaceList(me, list) {
    me.lists = me.lists.map(function (l) { return l.id === list.id ? list : l; });
  }

  function renderMyLists(me) {
    var r = screen();
    add(r, el("h2", null, "Mis listas"));
    var cards = el("div", "pn-gr-cards");
    me.lists.forEach(function (l) {
      var card = el("div", "pn-gr-card");
      add(card, el("h3", null, l.title), el("p", "pn-gr-muted", (EVENTS[l.eventType] || "") + " · " + formatDate(l.eventDate)),
        button("Ver lista", "pn-gr-btn pn-gr-btn--block", function () { go("panel&id=" + l.id); }));
      cards.appendChild(card);
    });
    r.appendChild(cards);
    var n = button("+ Crear otra lista", "pn-gr-btn pn-gr-btn--ghost", function () { renderListForm(me, null); });
    n.style.marginTop = "16px";
    r.appendChild(n);
  }

  function loadMe() {
    return api("GET", "/api/gr/me");
  }

  function renderPanelRoute() {
    if (!memory.token) return renderLogin(renderPanelRoute);
    loading();
    loadMe().then(function (me) {
      var id = params().get("id");
      var list = me.lists.filter(function (l) { return l.id === id; })[0];
      if (list) return renderPanel(me, list);
      if (!me.lists.length) return renderListForm(me, null);
      if (me.lists.length === 1) return renderPanel(me, me.lists[0]);
      renderMyLists(me);
    }).catch(function (e) {
      if (e.status === 401) return renderLogin(renderPanelRoute);
      showError(e);
    });
  }

  function renderGuestRoute(slug) {
    var r = screen();
    add(r, el("h2", null, "Lista de regalos"), el("p", "pn-gr-muted", "Estamos preparando esta lista. Volvé a entrar en un ratito."));
    if (window.console) console.info("[Lista de regalos] vista de invitado pendiente:", slug);
  }

  function route() {
    var p = params();
    if (p.get("lista")) return renderGuestRoute(p.get("lista"));
    if (p.has("panel")) return renderPanelRoute();
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
    if (!product || !memory.token || document.querySelector(".pn-gr-pdp")) return;
    var form = productForm();
    if (!form || !form.parentNode) return;

    loadMe().then(function (me) {
      var lists = me.lists.filter(function (l) { return l.status === "active"; });
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
        lists.forEach(function (l) { var o = el("option", null, l.title); o.value = l.id; select.appendChild(o); });
        box.appendChild(select);
      }
      var msg = el("p", "pn-gr-pdp-ok");
      var btn = button("♡ Agregar a mi lista de regalos", "pn-gr-btn pn-gr-btn--ghost pn-gr-btn--block", function () {
        var v = selectedVariant();
        if (!v) return;
        var qtyInput = form.querySelector(".js-quantity-input, input[name='quantity']");
        var quantity = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);
        var options = [v.option0, v.option1, v.option2].filter(Boolean).join(" / ");
        var listId = select ? select.value : lists[0].id;
        btn.disabled = true;
        msg.textContent = "";
        api("POST", "/api/gr/lists/" + listId + "/items", {
          item: {
            productId: product.id,
            variantId: v.id,
            name: product.name + (options ? " (" + options + ")" : ""),
            image: absUrl(v.image_url),
            price: v.price_number,
            quantity: quantity,
          },
        }).then(function () {
          msg.style.color = "";
          msg.textContent = "Agregado a tu lista ✓";
          var link = el("a", null, "Ver mi lista");
          link.href = pageUrl("panel&id=" + listId);
          msg.appendChild(link);
        }).catch(function (e) {
          msg.style.color = "#b3261e";
          msg.textContent = e.message;
        }).then(function () { btn.disabled = false; });
      });
      add(box, btn, msg);
      form.parentNode.insertBefore(box, form.nextSibling);
    }).catch(function () { /* sesion vencida: no se muestra */ });
  }

  // --- arranque ----------------------------------------------------------------

  function start() {
    var p = params();
    if (window.location.pathname === CFG.pagePath || p.get("lista") || p.has("panel")) route();
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
    texts: config.texts || {},
    styles: STYLES,
  };
  // JSON.stringify no escapa "</script>": se escapa "<" por si el JS se inlinea.
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  return `/* Lista de regalos - tienda ${cfg.store} */\n(${clientMain.toString()})(${json});\n`;
}

module.exports = { buildStorefrontScript, clientMain, STYLES };
