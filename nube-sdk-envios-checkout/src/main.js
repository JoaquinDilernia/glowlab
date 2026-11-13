/* GlowLab · Envíos agrupados en el checkout (Alto Rancho) — NubeSDK.
   Portado de la app "Altorancho Envios Checkout" que armó logística de Alto Rancho (nube/main.js, paquete del
   12/11/2026). Es el experimento "agrupado" del original, ahora siempre prendido. Se sacó el resto del laboratorio
   (estado, eventos, slots, selector_propio, opciones_mod, modal, validar, etc.) y el OCULTAR_PRUEBA.
   Corre aislado (Web Worker): lee las opciones de envío con precio y fechas, dibuja tres desplegables (domicilio /
   locales / punto de retiro), preselecciona la más barata a domicilio si el cliente no eligió, pone nombres cortos
   (custom labels) y manda una "foto" de las opciones al backend. Con esa foto la regla shipping/before-filter
   oculta opciones solo con datos reales.
   Diseño: docs/superpowers/specs/2026-11-13-alto-envios-design.md */
const BASE = "https://glowlab-production.up.railway.app";
const ALLOWED_STORES = ["2547699"];

export function App(nube) {
	const storeId = String(nube.getState().store?.id ?? "");
	if (!ALLOWED_STORES.includes(storeId)) return;

	// Los desplegables y las etiquetas se prenden desde el panel de GlowLab (enabled). La foto se manda siempre,
	// porque el filtro del checkout la necesita.
	let habilitado = false;
	// Diseño editable desde el panel (llega con la config); los defaults son el diseño original.
	let E = {
		fuente: "inherit", tamano: 14, radio: 8, mostrarIconos: true,
		colorTexto: "#111111", colorElegida: "#111111", colorBorde: "#e3e3e3",
		fondoTitulo: "#f3f3f3", fondoTituloElegida: "#dcdcdc",
		ecoFondo: "#E2EFDA", ecoTexto: "#2E6B1F", rapFondo: "#DDEBF7", rapTexto: "#1F4E79",
		pregunta: "¿Cómo querés recibirlo?",
		tituloDomicilio: "Envío a domicilio", tituloLocal: "Retiro en nuestros locales", tituloPunto: "Entrega en punto de retiro",
		textoEco: "Más económico", textoRap: "Más rápido",
	};
	const px = (n) => `${Math.round(n * 10) / 10}px`;

	let ultimaFirma = "";
	let preseleccionado = "";   // firma de las opciones para las que ya preseleccionamos
	let seleccionPropia = "";   // code de la opción que eligió el script (no el cliente)
	let fotoEnviada = "";

	const fecha = (d) => (d ? Date.parse(d) : Number.NaN);
	// El checkout identifica las opciones por su code (state.shipping.selected trae el code, no el id largo).
	const clave = (o) => String(o.code || o.id);

	// Componentes de UI sin JSX: objetos {type, ...props, __internalId} como arma @tiendanube/nube-sdk-ui.
	function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i); return (h >>> 0).toString(36); }
	function ui(type, props) {
		// OJO: el id tiene que distinguir componentes con hijos distintos (si no, un toque disparaba el onClick de
		// todas las filas y ganaba la última; visto por logística el 27/10/2026). Entran los ids de los hijos.
		const hijo = (c) => (c && typeof c === "object" ? c.__internalId || JSON.stringify(c) : c);
		const k = JSON.stringify(props, (key, v) => (key === "children" && typeof v !== "string" ? (Array.isArray(v) ? v.map(hijo) : hijo(v))
			: typeof v === "function" ? String(v) : v));
		const appId = (self.__APP_DATA__ && self.__APP_DATA__.id) || "app";
		return { type, ...props, __internalId: `${type}-${appId}-${hash(k)}` };
	}
	const txt = (children, extra) => ui("txt", { children, ...(extra || {}) });

	// Códigos reales de altorancho.com (26/10/2026): table_* (envío propio), api_<id>_ne-...-domicilio|sucursal
	// (Envío Nube), api_<id>_zippin_standard_N|pickup_N (Zipnova) y pickup-point_* (locales).
	function clasificar(o) {
		const cod = String(o.code || "").toLowerCase();
		const t = `${cod} ${o.name || ""} ${o.method || ""} ${o.type || ""}`.toLowerCase();
		let grupo = "domicilio";
		if (o.method === "pickup-point" || cod.startsWith("pickup-point") || (o.type === "pickup" && !o.app_id && !/sucursal|zippin|ne-/.test(t))) grupo = "local";
		else if (/sucursal|pickup|punto de retiro/.test(t) || o.type === "pickup") grupo = "punto";
		let transp = "Otro";
		if (/zippin|zipnova/.test(t)) transp = "Zipnova";
		else if (/ne-|env[ií]o nube/.test(t)) transp = "Envío Nube";
		else if (grupo === "local") transp = "Local";
		else if (o.method === "table" || cod.startsWith("table") || /^\d+$/.test(cod)) transp = "Envío propio";
		return { grupo, transp };
	}
	// Nombre para mostrar: sin el "Envío Nube - " repetido y con el transportista en los puntos de retiro.
	function nombreLindo(o) {
		const cod = String(o.code || "").toLowerCase();
		let n = String(o.name || "").replace(/^env[ií]o nube\s*-\s*/i, "");
		if (/^punto de retiro$/i.test(n)) {
			if (cod.includes("andreani")) n = "Andreani a sucursal";
			else if (cod.includes("expreso")) n = "Correo Argentino Expreso a sucursal";
			else if (cod.includes("clasico")) n = "Correo Argentino Clásico a sucursal";
			else if (/pickup_(\d+)/.test(cod)) n = `Punto de retiro ${cod.match(/pickup_(\d+)/)[1]}`;
		}
		return n;
	}
	// ---- nombres y fechas cortos (igual que el carrito) ----
	const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
	const NE = { "correo-arg-clasico": "Correo Argentino", "correo-arg-expreso": "Correo Argentino Expreso", andreani: "Andreani", oca: "OCA" };
	const titulo = (x) => String(x).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
	const hoy0 = () => { const h = new Date(); h.setHours(0, 0, 0, 0); return h; };
	const aDia = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
	const diaCorto = (f) => {
		const d = Math.round((f - hoy0()) / 86400000);
		if (d === 0) return "hoy";
		if (d === 1) return "mañana";
		return `${DIAS[f.getDay()]} ${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}`;
	};
	const rangoCk = (o) => {
		const a = aDia(o.min_delivery_date), b = aDia(o.max_delivery_date);
		if (!a && !b) return "";
		if (!a || !b || a.getTime() === b.getTime()) return diaCorto(a || b);
		return `${diaCorto(a)} – ${diaCorto(b)}`;
	};
	const diasCk = (o) => { const b = aDia(o.max_delivery_date); return b ? Math.round((b - hoy0()) / 86400000) : 999; };
	function corto(o) {
		const { grupo, transp } = clasificar(o);
		const n = String(o.name || "");
		const cod = String(o.code || "").toLowerCase();
		if (grupo === "local") return { t: titulo(n.replace(/^altorancho\s+/i, "")), extra: "" };
		if (transp === "Envío propio") return { t: "Envío Altorancho", extra: /dentro/i.test(n) ? "entrega dentro de tu domicilio" : "" };
		const ne = cod.match(/ne-([a-z0-9-]+?)-(domicilio|sucursal)$/);
		if (ne) return { t: NE[ne[1]] || titulo(ne[1].replace(/-/g, " ")), extra: ne[2] === "sucursal" ? "Sucursal" : "" };
		if (transp === "Zipnova") {
			if (grupo === "punto") return { t: "Punto de retiro", extra: "" };
			const z = n.split(" - ");
			if (z.length > 1) return { t: z[0].trim(), extra: "" };
			return { t: n.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+a domicilio$/i, "").trim() || "Envío", extra: "" };
		}
		return { t: nombreLindo(o).replace(/\s*\(\d+\)\s*$/, "").replace(/\s+a domicilio$/i, ""), extra: "" };
	}
	// Nombre para la lista nativa de TiendaNube ("Más opciones" y el modal "Cambiar" del paso de pago).
	// Los locales se dejan como vienen (TiendaNube les agrega la dirección).
	function nombreCompleto(o) {
		const { grupo, transp } = clasificar(o);
		if (grupo === "local" || transp === "Otro") return null;
		const c = corto(o);
		return c.extra ? `${c.t} · ${c.extra.toLowerCase()}` : c.t;
	}

	// Desplegables: arrancan cerrados, en el orden domicilio → locales → punto de retiro; el que el cliente abre se
	// recuerda (el script redibuja en cada cambio de estado) y el grupo con la opción elegida lleva el título más
	// oscuro. A la vista: la más barata y la más rápida; si con eso no aparece algún proveedor (Zipnova o Envío
	// Nube), su más barata; el envío propio siempre; y la elegida. El resto en "Ver N opciones más". Locales, todos.
	let grupoAbiertoCk = null;
	const verMasCk = {};
	function agrupado(st) {
		// ojo: los retiros en local vienen con shippable:false y method "pickup-point" (no filtrar por shippable)
		// ojo: TiendaNube marca hidden:true a lo que pliega en "ver más"; no es un ocultamiento real, se usan todas.
		const ops = (st.shipping?.options || []).filter((o) => o);
		if (!ops.length) return;
		const grupos = { domicilio: [], punto: [], local: [] };
		for (const o of ops) { const c = clasificar(o); grupos[c.grupo].push({ o, transp: c.transp, p: Number(o.price) || 0, d: diasCk(o) }); }
		const plata = (n) => (Number(n) === 0 ? "Gratis" : (() => { try { return "$" + Math.round(Number(n)).toLocaleString("es-AR"); } catch (_) { return "$" + n; } })());
		const sel = st.shipping?.selected;
		const porPrecio = (a, b) => a.p - b.p || a.d - b.d;
		const T = E.tamano;   // 14 = tamaño original
		// los txt de TiendaNube traen margen y alto de línea propios; la fuente solo se ve si el checkout la tiene cargada
		const T0 = { margin: "0", lineHeight: "1.25", ...(E.fuente !== "inherit" ? { fontFamily: `'${E.fuente}', sans-serif` } : {}) };
		const etiqueta = (texto, fondo, color) => ui("box", { padding: "0 6px", borderRadius: "9px", background: fondo, children: [txt(texto, { modifiers: ["bold"], style: { ...T0, fontSize: px(T * 10.5 / 14), lineHeight: "1.5", color, whiteSpace: "nowrap" } })] });
		const verbos = { domicilio: "Llega", local: "Retirás", punto: "Retirás" };
		// Fila compacta: círculo, nombre corto (+ etiqueta) y abajo cuándo; precio a la derecha.
		const filaOpcion = (x, elegida, grupo, eco, rap) => {
			const c = corto(x.o);
			const r = rangoCk(x.o);
			const cuando = r ? `${verbos[grupo]} ${r}` : "";
			const linea = !c.extra ? cuando : (grupo === "domicilio" ? [cuando, c.extra].filter(Boolean).join(" · ")
				: c.extra + (cuando ? " · " + cuando.charAt(0).toLowerCase() + cuando.slice(1) : ""));
			return ui("button", {
				variant: "transparent", width: "100%",
				style: { display: "block", width: "100%", boxSizing: "border-box", textAlign: "left", padding: "6px 9px", border: `1px solid ${elegida ? E.colorElegida : E.colorBorde}`,
					borderRadius: px(E.radio * 6 / 8), background: elegida ? "#fafafa" : "#fff", color: E.colorTexto, whiteSpace: "normal", lineHeight: "1.25" },
				// al elegir, el grupo queda abierto (el script redibuja con la opción nueva)
				onClick: () => { grupoAbiertoCk = grupo; nube.send("shipping:select", () => ({ shipping: { selected: clave(x.o) } })); },
				children: [ui("row", { justifyContent: "space-between", alignItems: "center", gap: "10px", children: [
					ui("row", { alignItems: "center", gap: "9px", children: [
						txt(elegida ? "◉" : "○", { style: { ...T0, fontSize: px(T * 19 / 14), color: elegida ? E.colorElegida : "#aaa", lineHeight: "1" } }),
						ui("col", { gap: "1px", children: [
							ui("row", { alignItems: "center", gap: "6px", style: { flexWrap: "wrap" }, children: [
								txt(c.t, { modifiers: ["bold"], style: { ...T0, color: E.colorTexto, fontSize: px(T) } }),
								...(eco ? [etiqueta(E.textoEco, E.ecoFondo, E.ecoTexto)] : []),
								...(rap ? [etiqueta(E.textoRap, E.rapFondo, E.rapTexto)] : []),
							] }),
							...(linea ? [txt(linea, { style: { ...T0, color: "#666", fontSize: px(T * 12 / 14) } })] : []),
						] }),
					] }),
					txt(plata(x.o.price), { modifiers: ["bold"], style: { ...T0, color: E.colorTexto, fontSize: px(T), whiteSpace: "nowrap" } }),
				] })],
			});
		};
		const titulos = { domicilio: E.tituloDomicilio, local: E.tituloLocal, punto: E.tituloPunto };
		// Íconos de Google (Material Symbols) servidos como SVG por el backend, del color del texto.
		const icono = (g) => ui("img", { src: `${BASE}/api/alto-envios/icono/${g}.svg?c=${String(E.colorTexto).replace("#", "")}`,
			alt: "", width: "20px", height: "20px", style: { width: "20px", height: "20px", flexShrink: 0 } });
		const items = [];
		for (const g of ["domicilio", "local", "punto"]) {
			const todas = grupos[g];
			if (!todas.length) continue;
			const vista = [];
			const sumar = (x) => { if (x && !vista.includes(x)) vista.push(x); };
			if (g === "local") todas.forEach(sumar);
			else {
				sumar([...todas].sort(porPrecio)[0]);
				sumar(todas.filter((x) => x.d < 999).sort((a, b) => a.d - b.d || a.p - b.p)[0]);
				for (const prov of ["Zipnova", "Envío Nube"]) {
					if (!vista.some((x) => x.transp === prov)) sumar(todas.filter((x) => x.transp === prov).sort(porPrecio)[0]);
				}
				todas.filter((x) => x.transp === "Envío propio").forEach(sumar);
			}
			const elegidaX = todas.find((x) => clave(x.o) === sel);
			sumar(elegidaX);
			vista.sort(porPrecio);
			const resto = todas.filter((x) => !vista.includes(x)).sort(porPrecio);
			const ps = todas.map((x) => x.p), ds = todas.map((x) => x.d);
			const minP = Math.min(...ps), maxP = Math.max(...ps), minD = Math.min(...ds), maxD = Math.max(...ds);
			const eco = todas.length > 1 && minP < maxP ? [...todas].sort(porPrecio)[0] : null;
			const rap = todas.length > 1 && minD < maxD && minD < 999 ? [...todas].sort((a, b) => a.d - b.d || a.p - b.p)[0] : null;
			const sub = todas.every((x) => x.p === 0) ? "Gratis" : (minP === 0 ? "con opción gratis" : `desde ${plata(minP)}`);
			const filas = (verMasCk[g] ? vista.concat(resto) : vista).map((x) => filaOpcion(x, x === elegidaX, g, x === eco, x === rap));
			if (resto.length) {
				// OJO: "grupo" va en las props para que el botón de cada grupo tenga su propio __internalId.
				filas.push(ui("button", { variant: "transparent", grupo: g, style: { padding: "2px", textAlign: "left", textDecoration: "underline", color: "#555", fontSize: px(T * 12 / 14) },
					onClick: () => { verMasCk[g] = !verMasCk[g]; grupoAbiertoCk = g; agrupado(nube.getState()); },
					children: verMasCk[g] ? "Ver menos" : `Ver ${resto.length} ${resto.length === 1 ? "opción más" : "opciones más"}` }));
			}
			items.push(ui("accordionItem", { value: g, onToggle: () => { grupoAbiertoCk = grupoAbiertoCk === g ? null : g; }, children: [
				ui("accordionHeader", { showIcon: true, style: { background: elegidaX ? E.fondoTituloElegida : E.fondoTitulo, borderRadius: px(E.radio) }, children: [
					ui("row", { alignItems: "center", gap: "8px", children: [
						...(E.mostrarIconos ? [icono(g)] : []),
						ui("col", { gap: "1px", children: [
							txt(titulos[g], { modifiers: ["bold"], style: { ...T0, fontSize: px(T), color: E.colorTexto } }),
							txt(sub, { style: { ...T0, fontSize: px(T * 12 / 14), color: "#555" } }),
						] }),
					] }),
				] }),
				ui("accordionContent", { children: [ui("col", { gap: "4px", children: filas })] }),
			] }));
		}
		nube.render("before_shipping_form", ui("col", { gap: "6px", padding: "4px", children: [
			...(E.pregunta ? [txt(E.pregunta, { modifiers: ["bold"], style: { color: E.colorTexto, ...(T0.fontFamily ? { fontFamily: T0.fontFamily } : {}) } })] : []),
			ui("accordionRoot", { ...(grupoAbiertoCk ? { defaultValue: grupoAbiertoCk } : {}), children: items }),
		] }));
	}

	function elegir(lista) {
		if (!lista.length) return {};
		const barata = [...lista].sort(
			(a, b) => a.price - b.price || (fecha(a.max_delivery_date) || 0) - (fecha(b.max_delivery_date) || 0),
		)[0];
		const conFecha = lista.filter((o) => !Number.isNaN(fecha(o.max_delivery_date)));
		const rapida = conFecha.sort(
			(a, b) => fecha(a.max_delivery_date) - fecha(b.max_delivery_date) || a.price - b.price,
		)[0];
		return { barata, rapida };
	}

	// Foto de las opciones cotizadas (sin datos personales: CP, ids, precios y fechas) para el filtro del checkout.
	function foto(st, opciones) {
		const firma = opciones.map((o) => `${o.id}:${o.price}`).join(",");
		if (firma === fotoEnviada) return;
		fotoEnviada = firma;
		const cuerpo = {
			store_id: st.store?.id,
			cart_id: st.cart?.id,
			zipcode: st.cart?.shipping_address?.zipcode || st.customer?.shipping_address?.zipcode || null,
			// productos y cantidades: el servicio reconoce otro carrito igual al mismo CP
			items: (st.cart?.items || []).map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
			opciones: opciones.map((o) => ({
				id: o.id, name: o.name, original_name: o.original_name, code: o.code, type: o.type, method: o.method,
				app_id: o.app_id, price: o.price, min_delivery_date: o.min_delivery_date, max_delivery_date: o.max_delivery_date,
				min_days: o.smart_date?.min_days, max_days: o.smart_date?.max_days,
			})),
		};
		try {
			// text/plain: sin preflight de CORS
			fetch(`${BASE}/api/alto-envios/foto`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(cuerpo) }).catch(() => {});
		} catch (_) {}
	}

	function evaluar() {
		try {
			const st = nube.getState();
			const opciones = (st.shipping?.options || []).filter((o) => o);
			if (!opciones.length) return;
			foto(st, opciones);
			if (!habilitado) return;
			const visibles = opciones; // hidden de TiendaNube = plegada en "ver más", no oculta
			const labels = {};
			const nombreDe = (o) => nombreCompleto(o) || o.name;
			// OJO (probado 27/10/2026): el checkout NO aplica custom_labels a las opciones type "pickup"; se mandan igual.
			for (const o of visibles) { const n = nombreCompleto(o); if (n) labels[clave(o)] = n; }
			for (const tipo of ["ship", "pickup"]) {
				const grupo = visibles.filter((o) => (tipo === "pickup" ? o.type === "pickup" : o.type !== "pickup"));
				if (grupo.length < 2) continue;
				const { barata, rapida } = elegir(grupo);
				if (barata) labels[clave(barata)] = `⭐ La más barata · ${nombreDe(barata)}`;
				if (rapida) {
					labels[clave(rapida)] = rapida === barata
						? `⭐ La más barata y la más rápida · ${nombreDe(rapida)}`
						: `⚡ La más rápida · ${nombreDe(rapida)}`;
				}
			}
			agrupado(st);
			const firma = JSON.stringify(labels) + "|" + visibles.map((o) => o.id).join(",");
			if (firma !== ultimaFirma) {
				ultimaFirma = firma;
				if (Object.keys(labels).length) nube.send("shipping:update:label", () => ({ shipping: { custom_labels: labels } }));
			}
			// Preselección: solo si el cliente no tiene una opción válida elegida (si eligió en el carrito, se respeta).
			// Al cambiar el CP, Zipnova renumera y cambian precios: si la elegida la había elegido el script (no el
			// cliente), se vuelve a elegir la más barata.
			const sel = st.shipping?.selected;
			const selValida = !!sel && opciones.some((o) => clave(o) === String(sel));
			const esNuestra = !!sel && String(sel) === seleccionPropia;
			const firmaOps = opciones.map((o) => `${clave(o)}:${o.price}:${o.name}`).sort().join(",");
			if ((!selValida || esNuestra) && preseleccionado !== firmaOps) {
				const { barata } = elegir(visibles.filter((o) => o.type !== "pickup"));
				if (barata) {
					preseleccionado = firmaOps;
					if (clave(barata) !== String(sel)) {
						seleccionPropia = clave(barata);
						nube.send("shipping:select", () => ({ shipping: { selected: clave(barata) } }));
					}
				}
			}
		} catch (e) {
			console.warn("[GlowLab Envíos] ", e);
		}
	}

	nube.on("checkout:ready", evaluar);
	nube.on("shipping:update", evaluar);
	nube.on("shipping:select:success", evaluar);
	evaluar();   // la foto sale aunque la config todavía no llegó

	fetch(`${BASE}/api/alto-envios/config?storeId=${storeId}`)
		.then((r) => (r.ok ? r.json() : null))
		.then((c) => {
			habilitado = !!(c && c.enabled);
			if (c && c.estilo && typeof c.estilo === "object") E = { ...E, ...c.estilo };
			if (habilitado) evaluar();
		})
		.catch(() => {});
}
