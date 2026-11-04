import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { effectsFor } from '../utils/styleMenu';

// Menú de la tienda (Ipanema) con los ajustes aplicados, como lo dibuja
// functions/style-menu.js. En compu: barra + desplegable; en celu: el menú hamburguesa.

function Label({ text, it }) {
  if (!it) return <span>{text}</span>;
  const style = {};
  if (it.look === 'pill') {
    Object.assign(style, { background: it.pillColor, color: it.pillTextColor, padding: '2px 9px', borderRadius: 999 });
  } else if (it.color) style.color = it.color;
  if (it.fontWeight) style.fontWeight = it.fontWeight;
  if (it.fontSize) style.fontSize = it.fontSize;
  if (it.uppercase) style.textTransform = 'uppercase';
  const label = it.emoji ? (it.emojiPosition === 'after' ? `${text} ${it.emoji}` : `${it.emoji} ${text}`) : text;
  return (
    <span className={`mp-label ${it.hidden ? 'mp-hidden' : ''}`} title={it.hidden ? 'Oculto en la tienda' : undefined}>
      <span style={style}>{label}</span>
      {it.badge && <span className="mp-badge" style={{ background: it.badgeColor, color: it.badgeTextColor }}>{it.badge}</span>}
    </span>
  );
}

function Promo({ it, mobile }) {
  const src = mobile ? (it.imageMobileUrl || it.imageUrl) : (it.imageUrl || it.imageMobileUrl);
  if (!src || (mobile && !it.imageOnMobile)) return null;
  return (
    <div className={mobile ? 'mp-promo-m' : 'mp-promo'}>
      <img src={src} alt="" />
      {it.imageCaption && <span>{it.imageCaption}</span>}
    </div>
  );
}

export default function MenuPreview({ tree, items, mobile, now, focus, onFocus, onPick }) {
  const fx = effectsFor(tree, items, { mobile, now });
  const [hover, setHover] = useState(null);
  const open = hover ?? focus;

  if (mobile) {
    const top = open != null && tree[open]?.children.length ? open : null;
    const node = top != null ? tree[top] : null;
    const topIt = top != null ? fx.get(`${top}:`) : null;
    return (
      <div className="mp-mobile">
        <div className="mp-m-head">
          {node ? <button type="button" onClick={() => { setHover(null); onFocus?.(null); }}>‹ {node.label}</button> : <strong>Menú</strong>}
          <span>✕</span>
        </div>
        {!node && tree.map((n, i) => (
          <button type="button" key={i} className="mp-m-item" onClick={() => n.children.length && setHover(i)}>
            <Label text={n.label} it={fx.get(`${i}:`)} />
            {n.children.length > 0 && <ChevronRight size={14} />}
          </button>
        ))}
        {node && (
          <>
            <div className="mp-m-item mp-m-all">Ver todo en {node.label}</div>
            {node.children.map((s, j) => (
              <div key={j} className="mp-m-item" onClick={() => onPick?.(top, j)}><Label text={s} it={fx.get(`${top}:${j}`)} /></div>
            ))}
            {topIt && <Promo it={topIt} mobile />}
          </>
        )}
      </div>
    );
  }

  const node = open != null ? tree[open] : null;
  const topIt = open != null ? fx.get(`${open}:`) : null;
  return (
    <div className="mp-desktop" onMouseLeave={() => setHover(null)}>
      <div className="mp-bar">
        {tree.map((n, i) => (
          <span key={i} className={`mp-top ${open === i ? 'mp-open' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => onPick?.(i, null)}>
            <Label text={n.label} it={fx.get(`${i}:`)} />
            {n.children.length > 0 && <ChevronDown size={11} />}
          </span>
        ))}
      </div>
      {node && (node.children.length > 0 || topIt?.imageUrl) && (
        <div className="mp-drop">
          <div className="mp-cols">
            {node.children.map((s, j) => (
              <div key={j} className="mp-sub" onClick={() => onPick?.(open, j)}><Label text={s} it={fx.get(`${open}:${j}`)} /></div>
            ))}
          </div>
          {topIt && <Promo it={topIt} />}
        </div>
      )}
    </div>
  );
}
