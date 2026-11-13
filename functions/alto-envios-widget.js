/* Altorancho · desplegables de envío en la TIENDA (carrito lateral y página de producto).
   Código del tema (27/10/2026). Reagrupa la lista del calculador de envíos de TiendaNube en tres desplegables
   (domicilio / locales / punto de retiro).
   28/10/2026 (Pedro eligió la "opción 2" del mockup): filas compactas con el nombre corto de quién lo lleva
   (Chazki, Toparco, Correo Argentino, Andreani, Envío Altorancho; sin "Zipnova/Envío Nube" ni "a domicilio (1)")
   y abajo la fecha corta ("Llega jue 29/10 – lun 02/11"); etiquetas "Más económico" / "Más rápido".
   A la vista (regla de Pedro, 28/10/2026): la más barata y la más rápida del grupo; si con eso no aparece algún
   proveedor (Zipnova o Envío Nube), se suma la más barata de ese proveedor; el envío propio siempre; y la elegida.
   El resto en "Ver N opciones más". Locales, todos. Orden por precio. */
(function () {
  "use strict";
  if (window.__altoEnviosTema) return;
  window.__altoEnviosTema = true;

  // GlowLab (13/11/2026): diseño editable desde el panel. El backend antepone window.__altoEnviosCfg; los
  // defaults son el diseño de diseño gráfico de Alto Rancho (13/11/2026): grupos blancos con borde, flecha a la
  // izquierda, la opción elegida con fondo gris, textos chicos en minúscula y "ver N opciones más" bajo el grupo.
  const E = Object.assign({
    fuente: "Poppins", tamano: 14, radio: 10, mostrarIconos: true,
    colorTexto: "#111111", colorElegida: "#111111", colorBorde: "#dddddd",
    fondoTitulo: "#ffffff", fondoTituloElegida: "#f4f4f4",
    ecoFondo: "#E2EFDA", ecoTexto: "#2E6B1F", rapFondo: "#DDEBF7", rapTexto: "#1F4E79",
    pregunta: "¿cómo querés recibirlo?",
    tituloDomicilio: "Envío a domicilio", tituloLocal: "Retiro en nuestros locales", tituloPunto: "Entrega en punto de retiro",
    textoEco: "más económico", textoRap: "más rápido"
  }, window.__altoEnviosCfg || {});
  const px = function (n) { return (Math.round(n * 10) / 10) + "px"; };
  // Íconos de Google (Material Symbols: local_shipping, storefront, pin_drop) que antepone el backend.
  const ICONOS = window.__altoEnviosIconos || {};
  const icono = function (k) {
    return ICONOS[k] ? '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="' + ICONOS[k] + '"/></svg>' : "";
  };
  // Reglas de locales por SKU (13/11/2026): el calculador de la tienda no pasa por la regla de TiendaNube, así que
  // se le pregunta al backend qué locales sacar para los productos del carrito (o el del producto que se está viendo).
  const API = "https://glowlab-production.up.railway.app";
  const HAY_REGLAS = window.__altoEnviosLocales === true;
  const fueraPor = {};   // "ids de productos" -> Set de códigos | "cargando"
  const sinPrefijo = function (code) { return String(code || "").replace(/^pickup-point[_-]/, ""); };
  function productosDe(cont) {
    let el = cont;
    while (el && el !== document.body && !el.querySelector(".js-cart-item")) el = el.parentElement;
    const enCarrito = el && el !== document.body && el !== document.documentElement;
    let ids = [];
    if (enCarrito) {
      ids = Array.from(el.querySelectorAll('.js-cart-item[data-store^="cart-item-"]')).map(function (x) { return x.dataset.store.replace("cart-item-", ""); });
    } else if (window.LS && LS.product && LS.product.id) ids = [String(LS.product.id)];
    return ids.filter(function (x) { return /^[0-9]+$/.test(x); }).sort().filter(function (x, i, a) { return a.indexOf(x) === i; });
  }
  // Set de códigos a sacar, o null mientras se consulta (después se vuelve a armar).
  function localesFuera(cont) {
    if (!HAY_REGLAS) return new Set();
    const ids = productosDe(cont);
    if (!ids.length) return new Set();
    const k = ids.join(",");
    if (fueraPor[k] instanceof Set) return fueraPor[k];
    if (fueraPor[k] !== "cargando") {
      fueraPor[k] = "cargando";
      const tienda = (window.LS && LS.store && LS.store.id) || "";
      fetch(API + "/api/alto-envios/locales-ocultos?store=" + tienda + "&productos=" + k)
        .then(function (r) { return r.json(); })
        .then(function (j) { fueraPor[k] = new Set((j && j.ocultar) || []); })
        .catch(function () { fueraPor[k] = new Set(); })
        .then(function () { correr(); });
    }
    return null;
  }
  const T = E.tamano;          // 14 = tamaño original
  const R = E.radio;           // radio de los grupos y de la opción elegida
  const FAMILIA = E.fuente === "inherit" ? "inherit" : "'" + E.fuente + "', sans-serif";
  if (E.fuente !== "inherit" && !document.getElementById("alto-env-font")) {
    const l = document.createElement("link");
    l.id = "alto-env-font"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + E.fuente.replace(/ /g, "+") + ":wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }

  const CSS = `
  .alto-env{margin:8px 0 14px;font-size:${px(T)};line-height:1.3;font-family:${FAMILIA};color:${E.colorTexto}}
  .alto-env-q{margin:0 0 12px;font-size:${px(T * 20 / 14)};font-weight:600;line-height:1.2}
  .alto-env-g{border:1px solid ${E.colorBorde};border-radius:${px(R)};margin-bottom:10px;overflow:hidden;background:${E.fondoTitulo}}
  .alto-env-h{display:flex;align-items:center;gap:8px;width:100%;padding:12px 14px;background:none;border:0;cursor:pointer;text-align:left;font:inherit;color:inherit}
  .alto-env-h .alto-env-caret{flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;transition:transform .2s ease}
  .alto-env-h .alto-env-caret svg{width:20px;height:20px;fill:currentColor;display:block}
  .alto-env-g.abierto .alto-env-caret{transform:rotate(90deg)}
  .alto-env-h .alto-env-ic{width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center}
  .alto-env-h .alto-env-ic svg{width:22px;height:22px;fill:currentColor;display:block}
  .alto-env-h .alto-env-ht{flex:1;min-width:0}
  .alto-env-h .alto-env-ht b{display:block;font-weight:600;font-size:${px(T * 17 / 14)};line-height:1.25}
  .alto-env-h .alto-env-ht small{display:block;font-size:${px(T * 12 / 14)};color:#555;margin-top:1px}
  .alto-env-g.abierto .alto-env-ht small{display:none}
  .alto-env-b{display:none;padding:0 12px 12px}
  .alto-env-g.abierto .alto-env-b{display:block}
  .alto-env-o{display:flex;align-items:flex-start;gap:8px;width:100%;padding:9px 12px;margin:2px 0;border:1px solid transparent;border-radius:${px(R)};background:none;cursor:pointer;text-align:left;font:inherit;color:inherit;line-height:1.25}
  .alto-env-o.elegida{background:${E.fondoTituloElegida};border-color:${E.colorBorde}}
  .alto-env-o .alto-env-dot{width:12px;height:12px;border-radius:50%;border:1px solid #999;flex:none;box-sizing:border-box;margin-top:${px(T * 3.5 / 14)}}
  .alto-env-o.elegida .alto-env-dot{border-color:${E.colorElegida};background:radial-gradient(${E.colorElegida} 45%,#fff 52%)}
  .alto-env-o .alto-env-t{flex:1;min-width:0}
  .alto-env-o .alto-env-t b{font-weight:400;font-size:${px(T * 15 / 14)}}
  .alto-env-o .alto-env-t small{display:block;font-size:${px(T * 12 / 14)};color:#666;margin-top:2px}
  .alto-env-o .alto-env-p{white-space:nowrap;font-weight:600;font-size:${px(T * 15 / 14)};padding-left:8px}
  .alto-env-bd{display:inline-block;font-size:${px(T * 11.5 / 14)};font-weight:500;padding:1px 8px;border-radius:10px;margin-left:8px;vertical-align:1px;white-space:nowrap}
  .alto-env-bd.eco{background:${E.ecoFondo};color:${E.ecoTexto}}
  .alto-env-bd.rap{background:${E.rapFondo};color:${E.rapTexto}}
  .alto-env-todas{display:none;margin:-2px 0 12px 64px;background:none;border:0;padding:0;color:#333;text-decoration:underline;cursor:pointer;font:inherit;font-size:${px(T * 12 / 14)}}
  .alto-env-g.abierto + .alto-env-todas{display:block}
  .alto-env-oculto{display:none !important}
  .alto-env-fuera{display:none !important}
  /* el formulario "Cambiar CP" del tema queda invisible (opacidad 0) pero encima de la lista: su link
     "No sé mi código postal" (correoargentino.com.ar) recibía los toques sobre el título del primer grupo
     (visto por Pedro en el celular, 27/10/2026). Mientras está oculto, no recibe toques.
     28/10/2026: se marca con .alto-env-sinclic solo si está de verdad invisible (ver sinClic): con el carrito
     SIN CP guardado el tema muestra el formulario sin "transition-up-active" y la regla vieja no dejaba escribir. */
  .shipping-calculator .js-shipping-calculator-form.alto-env-sinclic,
  .shipping-calculator .js-shipping-calculator-form.alto-env-sinclic *{pointer-events:none !important}`;

  function css() {
    if (document.getElementById("alto-env-css")) return;
    const s = document.createElement("style");
    s.id = "alto-env-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function precio(txt) {
    const t = (txt || "").trim();
    if (/gratis/i.test(t)) return 0;
    const n = t.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const v = parseFloat(n);
    return isNaN(v) ? 9e12 : v;
  }

  // ---------------------------------------------------------------- fechas --
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function hoy0() { const h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function aFecha(dd, mm) {
    const h = hoy0();
    let f = new Date(h.getFullYear(), mm - 1, dd);
    if (f < h && (h - f) > 60 * 86400000) f = new Date(h.getFullYear() + 1, mm - 1, dd);   // diciembre → enero
    return f;
  }
  // "Llega entre el jueves 29/10 y el lunes 02/11" / "Llega entre hoy y el jueves 29/10" / "Retiras entre…"
  // → lista de fechas (Date) en orden
  function fechas(txt) {
    const out = [];
    const re = /(hoy|ma[ñn]ana|(\d{1,2})\/(\d{1,2}))/gi;
    let m;
    while ((m = re.exec(txt || ""))) {
      const w = m[1].toLowerCase();
      if (w === "hoy") out.push(hoy0());
      else if (/^ma/.test(w)) { const f = hoy0(); f.setDate(f.getDate() + 1); out.push(f); }
      else out.push(aFecha(parseInt(m[2], 10), parseInt(m[3], 10)));
    }
    return out;
  }
  function diaCorto(f) {
    const d = Math.round((f - hoy0()) / 86400000);
    if (d === 0) return "hoy";
    if (d === 1) return "mañana";
    return DIAS[f.getDay()] + " " + ("0" + f.getDate()).slice(-2) + "/" + ("0" + (f.getMonth() + 1)).slice(-2);
  }
  // "entre jueves 19/11 - martes 24/11" / "miércoles 18/11" ("" si el tema no trajo fechas)
  function rango(fs) {
    if (!fs.length) return "";
    const a = fs[0], b = fs[fs.length - 1];
    return a.getTime() === b.getTime() ? diaCorto(a) : "entre " + diaCorto(a) + " - " + diaCorto(b);
  }
  function diasHasta(fs) { return fs.length ? Math.round((fs[fs.length - 1] - hoy0()) / 86400000) : 999; }

  // ---------------------------------------------------------------- nombres --
  function titulo(s) { return s.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  const NE = { "correo-arg-clasico": "Correo Argentino", "correo-arg-expreso": "Correo Argentino Expreso", andreani: "Andreani", oca: "OCA" };

  function clasificar(code, tipo) {
    if (code.indexOf("pickup-point") === 0) return { grupo: "local", carrier: "Local" };
    const grupo = tipo === "pickup" ? "punto" : "domicilio";
    if (/zippin|zipnova/i.test(code)) return { grupo, carrier: "Zipnova" };
    if (/_ne-|^ne-/.test(code)) return { grupo, carrier: "Envío Nube" };
    if (code.indexOf("table_") === 0) return { grupo, carrier: "Envío propio" };
    return { grupo, carrier: "Otro" };
  }

  // Nombre corto (lo que ve el cliente) y una aclaración para la línea de abajo.
  function nombreCorto(o) {
    const n = o.nombre;
    if (o.carrier === "Local") {
      const m = n.match(/^(?:altorancho\s+)?([^-]+?)\s*-\s*([^,]+)/i);
      return m ? { t: titulo(m[1]), extra: m[2].trim() } : { t: titulo(n.replace(/^altorancho\s+/i, "")), extra: "" };
    }
    if (o.carrier === "Envío propio") return { t: "Envío Altorancho", extra: /dentro/i.test(n) ? "entrega dentro de tu domicilio" : "" };
    const ne = o.code.match(/ne-([a-z0-9-]+?)-(domicilio|sucursal)$/);
    if (ne) return { t: NE[ne[1]] || titulo(ne[1].replace(/-/g, " ")), extra: ne[2] === "sucursal" ? "Sucursal" : "" };
    if (o.carrier === "Zipnova") {
      if (o.grupo === "punto") return { t: "Punto de retiro", extra: "" };
      const z = n.split(" - ");
      if (z.length > 1) return { t: z[0].trim(), extra: "" };                 // "Chazki - Estandar a domicilio (1)"
      return { t: n.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+a domicilio$/i, "").trim() || "Envío", extra: "" };
    }
    return { t: n.replace(/^Env[ií]o Nube - /i, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+a domicilio$/i, ""), extra: "" };
  }

  function leer(cont) {
    const lis = Array.from(cont.querySelectorAll("li.js-shipping-list-item"));
    return lis.map(function (li) {
      const code = (li.dataset.store || "").replace("shipping-calculator-item-", "");
      const label = li.querySelector("label.js-shipping-radio");
      const nombre = ((li.querySelector('[data-component="option.name"]') || {}).textContent || "").trim().replace(/\s+/g, " ");
      const fecha = ((li.querySelector('[data-component="option.date"]') || {}).textContent || "").trim().replace(/\s+/g, " ");
      const p = ((li.querySelector('[data-component="option.price"]') || {}).textContent || "").trim();
      const c = clasificar(code, label ? label.dataset.shippingType : "delivery");
      const fs = fechas(fecha);
      return { li, label, code, grupo: c.grupo, carrier: c.carrier, nombre, fecha, fs,
        precioTxt: p, precio: precio(p), dias: diasHasta(fs) };
    }).filter(function (o) { return o.code; });
  }

  // Qué se ve sin tocar "Ver más" (regla de Pedro, 28/10/2026): la más barata y la más rápida; un lugar para cada
  // proveedor que no quedó representado (su más barata); el envío propio siempre. Cada proveedor tiene su chance.
  const PROVEEDORES = ["Zipnova", "Envío Nube"];
  function aLaVista(todas) {
    const porPrecio = function (a, b) { return a.precio - b.precio || a.dias - b.dias; };
    const porRapido = function (a, b) { return a.dias - b.dias || a.precio - b.precio; };
    const vista = [];
    const sumar = function (o) { if (o && vista.indexOf(o) < 0) vista.push(o); };
    sumar(todas.slice().sort(porPrecio)[0]);
    sumar(todas.filter(function (o) { return o.dias < 999; }).sort(porRapido)[0]);
    PROVEEDORES.forEach(function (c) {
      if (!vista.some(function (o) { return o.carrier === c; })) sumar(todas.filter(function (o) { return o.carrier === c; }).sort(porPrecio)[0]);
    });
    todas.filter(function (o) { return o.carrier === "Envío propio"; }).forEach(sumar);
    return vista;
  }

  function fmt(v) { return v === 0 ? "gratis" : "$" + Math.round(v).toLocaleString("es-AR"); }

  const GRUPOS = [
    { k: "domicilio", titulo: E.tituloDomicilio, verbo: "llega" },
    { k: "local", titulo: E.tituloLocal, verbo: "retirás" },   // 28/10/2026 (Pedro): locales antes que puntos
    { k: "punto", titulo: E.tituloPunto, verbo: "retirás" }
  ];

  // Los grupos arrancan CERRADOS; el que abre el cliente se recuerda cuando el tema redibuja (cambio de cantidad o CP).
  let grupoAbierto = null;
  const verTodas = {};   // grupo → true si el cliente tocó "Ver N opciones más"

  function armar(cont) {
    const fuera = localesFuera(cont);
    if (fuera === null) return;   // esperando al backend: se arma cuando contesta
    const todasOps = leer(cont);
    const ops = todasOps.filter(function (o) { return !fuera.has(sinPrefijo(o.code)); });
    // el local oculto tampoco tiene que quedar en la lista del tema (si estaba elegido, el tema lo manda al checkout)
    todasOps.forEach(function (o) { o.li.classList.toggle("alto-env-fuera", fuera.has(sinPrefijo(o.code))); });
    const ul = cont.querySelector("ul.radio-button-container");
    if (ops.length < 2 || !ul) {
      // con 0 o 1 opciones no hay nada que agrupar: si quedó un desplegable viejo se saca y se vuelve a mostrar
      // la lista del tema (si no, el cliente vería opciones viejas o nada; visto en pruebas el 27/10/2026)
      const viejo = cont.querySelector(".alto-env");
      if (viejo) { viejo.remove(); ocultar(cont, false); }
      return;
    }
    const firma = ops.map(function (o) { return o.code + ":" + o.precioTxt + ":" + o.fecha; }).join(",") + "|" + Array.from(fuera).join(",");
    const previo = cont.querySelector(".alto-env");
    if (previo && previo.dataset.firma === firma) {
      // el tema a veces vuelve a dibujar sus bloques sin cambiar las opciones: hay que volver a esconderlos
      if (!previo.classList.contains("alto-env-oculto")) ocultar(cont, true);
      return;
    }
    if (previo) previo.remove();

    const raiz = document.createElement("div");
    raiz.className = "alto-env";
    raiz.dataset.firma = firma;
    if (E.pregunta) { const q = document.createElement("div"); q.className = "alto-env-q"; q.textContent = E.pregunta; raiz.appendChild(q); }
    const elegidaActual = ops.find(function (o) { return o.label && o.label.querySelector("input") && o.label.querySelector("input").checked; });
    GRUPOS.forEach(function (g) {
      const todas = ops.filter(function (o) { return o.grupo === g.k; });
      if (!todas.length) return;
      const porPrecio = function (a, b) { return a.precio - b.precio || a.dias - b.dias; };
      // a la vista: locales todos; si no, la regla de aLaVista; la elegida siempre se ve
      const vista = g.k === "local" ? todas.slice() : aLaVista(todas);
      if (elegidaActual && elegidaActual.grupo === g.k && vista.indexOf(elegidaActual) < 0) vista.push(elegidaActual);
      vista.sort(porPrecio);
      const resto = todas.filter(function (o) { return vista.indexOf(o) < 0; }).sort(porPrecio);
      // etiquetas: la más barata y la que llega antes (si hay diferencia entre opciones)
      const minP = Math.min.apply(null, todas.map(function (o) { return o.precio; }));
      const maxP = Math.max.apply(null, todas.map(function (o) { return o.precio; }));
      const minD = Math.min.apply(null, todas.map(function (o) { return o.dias; }));
      const maxD = Math.max.apply(null, todas.map(function (o) { return o.dias; }));
      const eco = todas.length > 1 && minP < maxP ? todas.slice().sort(porPrecio)[0] : null;
      const rap = todas.length > 1 && minD < maxD && minD < 999 ? todas.slice().sort(function (a, b) { return a.dias - b.dias || a.precio - b.precio; })[0] : null;

      const caja = document.createElement("div");
      caja.className = "alto-env-g" + (g.k === grupoAbierto ? " abierto" : "");
      const h = document.createElement("button");
      h.type = "button"; h.className = "alto-env-h";
      const sub = todas.every(function (o) { return o.precio === 0; }) ? "gratis" : (minP === 0 ? "con opción gratis" : "desde " + fmt(minP));
      h.innerHTML = '<span class="alto-env-caret">' + icono("derecha") + '</span>' + (E.mostrarIconos ? '<span class="alto-env-ic">' + icono(g.k) + '</span>' : '') + '<span class="alto-env-ht"><b></b><small></small></span>';
      h.querySelector("b").textContent = g.titulo;
      h.querySelector("small").textContent = sub;
      h.onclick = function () {
        const abrir = !caja.classList.contains("abierto");
        Array.from(raiz.querySelectorAll(".alto-env-g")).forEach(function (x) { x.classList.toggle("abierto", x === caja && abrir); });
        grupoAbierto = abrir ? g.k : null;
      };
      const b = document.createElement("div");
      b.className = "alto-env-b";
      vista.concat(resto).forEach(function (o, i) {
        const btn = document.createElement("button");
        btn.type = "button";
        const esResto = i >= vista.length;
        btn.className = "alto-env-o" + (esResto && !verTodas[g.k] ? " alto-env-resto alto-env-oculto" : (esResto ? " alto-env-resto" : "")) +
          (elegidaActual === o ? " elegida" : "");
        const nc = nombreCorto(o);
        const dot = document.createElement("span"); dot.className = "alto-env-dot";
        const t = document.createElement("span"); t.className = "alto-env-t";
        const tb = document.createElement("b"); tb.textContent = nc.t; t.appendChild(tb);
        if (o === eco) { const s1 = document.createElement("span"); s1.className = "alto-env-bd eco"; s1.textContent = E.textoEco; t.appendChild(s1); }
        if (o === rap) { const s2 = document.createElement("span"); s2.className = "alto-env-bd rap"; s2.textContent = E.textoRap; t.appendChild(s2); }
        const r = rango(o.fs);
        const cuando = r ? g.verbo + " " + r : (o.fecha || "").toLowerCase();
        // domicilio: "Llega jue 29/10 – lun 02/11 · entrega dentro de tu domicilio"
        // retiros:   "Av Libertador 5926 · retirás vie 30/10 – sáb 31/10" / "Sucursal · retirás …"
        const linea = !nc.extra ? cuando
          : (g.k === "domicilio" ? (cuando ? cuando + " · " : "") + nc.extra
            : nc.extra + (cuando ? " · " + cuando.charAt(0).toLowerCase() + cuando.slice(1) : ""));
        if (linea) { const sm = document.createElement("small"); sm.textContent = linea; t.appendChild(sm); }
        const sp = document.createElement("span"); sp.className = "alto-env-p";
        sp.textContent = fmt(o.precio);
        btn.appendChild(dot); btn.appendChild(t); btn.appendChild(sp);
        btn.onclick = function () {
          Array.from(raiz.querySelectorAll(".alto-env-o")).forEach(function (x) { x.classList.remove("elegida"); });
          btn.classList.add("elegida");
          // deja elegida la misma opción en la lista original del tema. 29/10/2026: si el tema redibujó la lista,
          // el label guardado ya no está en la página: se busca el actual por código.
          let lab = o.label;
          if (!lab || !lab.isConnected) {
            const li = Array.from(document.querySelectorAll("li.js-shipping-list-item")).find(function (x) {
              return (x.dataset.store || "").replace("shipping-calculator-item-", "") === o.code;
            });
            lab = li ? li.querySelector("label.js-shipping-radio") : null;
          }
          if (lab) lab.click();
        };
        b.appendChild(btn);
      });
      let mas = null;
      if (resto.length) {
        mas = document.createElement("button");
        mas.type = "button"; mas.className = "alto-env-todas";
        const textoMas = "ver " + resto.length + (resto.length === 1 ? " opción más" : " opciones más");
        mas.textContent = verTodas[g.k] ? "ver menos" : textoMas;
        mas.onclick = function () {
          verTodas[g.k] = !verTodas[g.k];
          Array.from(b.querySelectorAll(".alto-env-resto")).forEach(function (x) { x.classList.toggle("alto-env-oculto", !verTodas[g.k]); });
          mas.textContent = verTodas[g.k] ? "ver menos" : textoMas;
        };
      }
      caja.appendChild(h); caja.appendChild(b);
      raiz.appendChild(caja);
      if (mas) raiz.appendChild(mas);   // "ver N opciones más" va debajo del grupo, fuera del recuadro
    });
    const bloque = cont.querySelector(".shipping-options") || ul;
    bloque.parentElement.insertBefore(raiz, bloque);
    ocultar(cont, true);
  }

  function ocultar(cont, si) {
    // esconde los bloques originales del tema (título + lista + "Ver más opciones") mientras se ven los desplegables
    Array.from(cont.querySelectorAll("ul.radio-button-container, .shipping-options-heading")).forEach(function (u) {
      u.classList.toggle("alto-env-oculto", si);
    });
    Array.from(cont.querySelectorAll("a, button")).forEach(function (a) {
      if (/m[aá]s opciones|ver m[aá]s/i.test(a.textContent) && !a.classList.contains("alto-env-todas")) a.classList.toggle("alto-env-oculto", si);
    });
  }

  // El formulario de CP no recibe toques solo mientras está invisible (opacidad ~0) y no activo.
  function sinClic() {
    Array.from(document.querySelectorAll(".shipping-calculator .js-shipping-calculator-form")).forEach(function (f) {
      let invisible = false;
      try { invisible = !f.classList.contains("transition-up-active") && parseFloat(getComputedStyle(f).opacity) < 0.05; } catch (e) { /* nada */ }
      if (f.classList.contains("alto-env-sinclic") !== invisible) f.classList.toggle("alto-env-sinclic", invisible);
    });
  }

  function correr() {
    css();
    sinClic();
    Array.from(document.querySelectorAll(".shipping-wrapper, .js-shipping-calculator-response")).forEach(function (c) {
      try { armar(c); } catch (e) { /* nunca romper la tienda */ }
    });
  }

  // Se vuelve a correr cuando cambia el DOM (el tema redibuja el calculador al cambiar CP o cantidad).
  // OJO: NO usar debounce (esperar a que el DOM "se calme"): la cinta de cuotas del tema real muta el DOM cada
  // 100 ms y el rearmado no corría nunca (visto el 27/10/2026). Se corre como mucho cada 250 ms; es barato porque
  // armar() no hace nada si las opciones no cambiaron.
  let pendiente = false;
  new MutationObserver(function () {
    if (pendiente) return;
    pendiente = true;
    setTimeout(function () { pendiente = false; correr(); }, 250);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(sinClic, 400);   // el tema muestra/oculta el formulario cambiando clases y opacidad (no childList)
  correr();
})();
