/* GlowLab · Aviso de transferencia en el checkout (Alto Rancho) — NubeSDK.
   Cuando el cliente elige pagar por transferencia, debajo de los medios de pago aparecen dos carteles: la
   transferencia inmediata y el pedido de no pagar (y escribir por WhatsApp) a quien quiera pagar sin retenciones.
   Textos, colores y WhatsApp vienen del panel (GET /api/aviso-transferencia/config); backend en
   functions/aviso-transferencia.js. */
const BASE = "https://glowlab-production.up.railway.app";
const ALLOWED_STORES = ["2547699"];
const SLOT = "after_payment_options";

export function App(nube) {
	const storeId = String(nube.getState().store?.id ?? "");
	if (!ALLOWED_STORES.includes(storeId)) return;

	let cfg = null;          // config del panel; null hasta que llega
	let mostrando = "";      // firma de lo dibujado ("" = nada)

	// Componentes sin JSX: {type, ...props, __internalId}, como en nube-sdk-envios-checkout.
	function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i); return (h >>> 0).toString(36); }
	function ui(type, props) {
		const hijo = (c) => (c && typeof c === "object" ? c.__internalId || JSON.stringify(c) : c);
		const k = JSON.stringify(props, (key, v) => (key === "children" && typeof v !== "string" ? (Array.isArray(v) ? v.map(hijo) : hijo(v)) : v));
		const appId = (self.__APP_DATA__ && self.__APP_DATA__.id) || "app";
		return { type, ...props, __internalId: `${type}-${appId}-${hash(k)}` };
	}
	const txt = (children, style, extra) => ui("txt", { children, style: { margin: "0", lineHeight: "1.45", color: cfg.textColor, fontFamily: "Poppins, system-ui, sans-serif", ...style }, ...(extra || {}) });

	const esTransferencia = (sel) => {
		if (!sel || typeof sel !== "object") return false;
		const tipo = `${sel.method_type || ""} ${sel.type || ""} ${sel.method || ""}`.toLowerCase();
		if (/wire|transfer/.test(tipo)) return true;
		const nombre = `${sel.name || ""} ${sel.method_name || ""} ${sel.template || ""}`.toLowerCase();
		return (cfg.palabras || []).some((p) => p && nombre.includes(p));
	};

	function cartel(clave, titulo, texto, boton) {
		return ui("box", {
			key: `aviso-transferencia-${clave}`, padding: "14px 16px", borderRadius: "10px", background: cfg.bgColor,
			style: { border: `1px solid ${cfg.borderColor}`, boxSizing: "border-box", width: "100%" },
			children: [ui("col", { gap: "6px", children: [
				...(titulo ? [txt(titulo, { fontSize: "15px", fontWeight: "600" })] : []),
				...(texto ? [txt(texto, { fontSize: "13px" })] : []),
				...(boton ? [boton] : []),
			] })],
		});
	}

	function dibujar() {
		if (!cfg) return;
		const sel = nube.getState().payment?.selected;
		const ver = cfg.enabled === true && esTransferencia(sel);
		const firma = ver ? JSON.stringify(cfg) : "";
		if (firma === mostrando) return;
		mostrando = firma;
		if (!ver) { nube.clearSlot(SLOT); return; }
		const wa = `https://wa.me/${cfg.whatsappPhone}?text=${encodeURIComponent(cfg.whatsappMessage || "")}`;
		const boton = ui("link", {
			href: wa, target: "_blank",
			style: { display: "inline-block", alignSelf: "flex-start", marginTop: "4px", padding: "9px 14px", borderRadius: "8px", background: cfg.buttonBgColor,
				color: cfg.buttonTextColor, textDecoration: "none", fontWeight: "600", fontSize: "13px", fontFamily: "Poppins, system-ui, sans-serif" },
			children: cfg.botonTexto,
		});
		nube.render(SLOT, ui("col", { gap: "10px", style: { marginTop: "12px" }, children: [
			cartel("inmediata", cfg.titulo1, cfg.texto1, null),
			cartel("retenciones", cfg.titulo2, cfg.texto2, cfg.whatsappPhone ? boton : null),
		] }));
	}

	nube.on("checkout:ready", dibujar);
	nube.on("payment:update", dibujar);

	fetch(`${BASE}/api/aviso-transferencia/config?storeId=${storeId}`)
		.then((r) => r.json())
		.then((j) => { if (j && j.success && j.config) { cfg = j.config; dibujar(); } })
		.catch(() => { /* sin config no se muestra nada */ });
}
