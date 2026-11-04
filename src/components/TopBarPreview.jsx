import { useEffect, useState } from 'react';
import { messageStatus, textColorFor } from '../utils/topAnnouncement';

// Barra de anuncios tal como la dibuja la tienda (functions/top-announcement.js).
export default function TopBarPreview({ config: c, mobile, now }) {
  const list = c.messages.filter(m => m.text.trim() && messageStatus(m, now) === 'live');
  let mode = mobile ? c.mobileMode : c.desktopMode;
  if (list.length === 1 && mode === 'rotate') mode = 'static';
  const [idx, setIdx] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (mode !== 'rotate' || list.length < 2) return undefined;
    let t;
    const id = setInterval(() => {
      setOut(true);
      t = setTimeout(() => { setIdx(i => i + 1); setOut(false); }, 350);
    }, c.rotateSeconds * 1000);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [mode, list.length, c.rotateSeconds]);

  const hidden = (c.visibility === 'desktop' && mobile) || (c.visibility === 'mobile' && !mobile);
  if (!list.length || hidden) {
    return (
      <div className="tb-empty">
        {hidden ? `Oculta en ${mobile ? 'celular' : 'computadora'}` : 'Sin mensajes activos'}
      </div>
    );
  }

  const font = c.font === 'inherit' ? '"Poppins", sans-serif' : `"${c.font}", sans-serif`;
  const justify = c.alignment === 'left' ? 'flex-start' : c.alignment === 'right' ? 'flex-end' : 'center';
  const style = {
    background: c.backgroundColor, color: c.textColor, fontFamily: font,
    fontSize: mobile ? c.mobileFontSize : c.fontSize, fontWeight: c.fontWeight,
    letterSpacing: `${c.letterSpacing}px`, textTransform: c.uppercase ? 'uppercase' : 'none',
    padding: `${c.padding}px ${mobile ? 12 : 16}px`,
    borderTop: c.borderTop ? `1px solid ${c.borderColor}` : 'none',
    borderBottom: c.borderBottom ? `1px solid ${c.borderColor}` : 'none',
  };

  const item = (m, key) => {
    const s = {};
    if (m.highlight === 'bold') s.fontWeight = 800;
    if (m.highlight === 'color') { s.color = m.highlightColor; s.fontWeight = 800; }
    if (m.highlight === 'pill') { s.background = m.highlightColor; s.color = textColorFor(m.highlightColor); s.fontWeight = 800; s.padding = '2px 10px'; s.borderRadius = 999; }
    if (m.link && c.linkUnderline === 'always') s.textDecoration = 'underline';
    return (
      <span key={key} className={`tb-item ${m.link && c.linkUnderline === 'hover' ? 'tb-link' : ''}`} style={s}>
        {m.emoji && <span aria-hidden="true">{m.emoji}</span>}
        {m.text}
      </span>
    );
  };
  const sep = (key) => (
    <span key={key} className="tb-sep" style={{ padding: `0 ${c.separator ? c.messageGap : Math.round(c.messageGap / 2)}px` }}>{c.separator}</span>
  );

  let body;
  if (mode === 'rotate') {
    const m = list[idx % list.length];
    body = <div className="tb-rotate" style={{ justifyContent: justify, textAlign: c.alignment }}>
      <span className={`tb-rot ${out ? 'tb-out' : ''}`}>{item(m, 'r')}</span>
    </div>;
  } else if (mode === 'marquee') {
    const group = (g) => (
      <div className="tb-group" key={g}>
        {[0, 1, 2].flatMap(r => list.flatMap((m, i) => [item(m, `${g}${r}${i}`), sep(`${g}${r}${i}s`)]))}
      </div>
    );
    const chars = list.reduce((n, m) => n + m.text.length + 4, 0) * 3;
    body = <div className="tb-marquee" style={{ '--tb-dur': `${Math.max(5, (chars * 7) / c.marqueeSpeed)}s` }}>{group('a')}{group('b')}</div>;
  } else {
    body = <div className="tb-static" style={{ justifyContent: justify }}>
      {list.flatMap((m, i) => (i > 0 ? [sep(`s${i}`), item(m, i)] : [item(m, i)]))}
    </div>;
  }

  return <div className="tb-bar" style={style}>{body}</div>;
}
