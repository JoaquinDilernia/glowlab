import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Keep ref in sync so the singleton can call it
  const addRef = useRef(null);

  const add = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    return id;
  }, []);

  addRef.current = add;

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => add(msg, 'success', dur),
    error:   (msg, dur) => add(msg, 'error',   dur ?? 5000),
    warn:    (msg, dur) => add(msg, 'warn',     dur),
    info:    (msg, dur) => add(msg, 'info',     dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ─── Inline container ────────────────────────────────────── */
import './ToastContainer.css';

function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" role="region" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-message">{stripEmoji(t.message)}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar">✕</button>
        </div>
      ))}
    </div>
  );
}

const ICONS = {
  success: '✓',
  error:   '✕',
  warn:    '⚠',
  info:    'ℹ',
};

// Remove leading emoji + status prefix that alerts used to include
function stripEmoji(msg) {
  return msg
    .replace(/^[✅❌⚠️👑⚡📦🎉]+\s*/u, '')
    .replace(/^(Error:|Error|WARNING|INFO):\s*/i, '');
}
