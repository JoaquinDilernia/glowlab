import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Palette, Clock, Sparkles, X, Loader } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './OnboardingWizard.css';

const PRESET_COLORS = [
  { name: 'Verde WhatsApp', bg: '#25D366', hover: '#128C7E' },
  { name: 'Negro elegante', bg: '#111111', hover: '#333333' },
  { name: 'Rojo intenso',   bg: '#E11D48', hover: '#9F1239' },
  { name: 'Azul confianza', bg: '#2563EB', hover: '#1D4ED8' },
  { name: 'Naranja vibrante', bg: '#F97316', hover: '#C2410C' },
  { name: 'Rosa moderno',   bg: '#EC4899', hover: '#BE185D' }
];

export default function OnboardingWizard({ storeId, onClose, onComplete }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  const finish = () => {
    localStorage.setItem('gl_onboarding_done', '1');
    if (onComplete) onComplete();
    if (onClose) onClose();
  };

  const skip = () => {
    localStorage.setItem('gl_onboarding_done', '1');
    if (onClose) onClose();
  };

  // ============ STEP 1: ACTIVAR WHATSAPP CON COLOR ============
  const activateWhatsapp = async () => {
    if (!storeId) {
      toast.error('No se pudo identificar tu tienda. Recargá la página.');
      return;
    }
    setActivating(true);
    try {
      // Cargar config existente para no pisar otros módulos
      let currentConfig = {};
      try {
        const data = await apiRequest(`/api/style-config?storeId=${storeId}`);
        if (data?.success && data.config) currentConfig = data.config;
      } catch (e) { /* primer load: no existe aún, ok */ }

      const newConfig = {
        ...currentConfig,
        whatsapp: {
          ...(currentConfig.whatsapp || {}),
          enabled: true,
          backgroundColor: selectedColor.bg,
          hoverColor: selectedColor.hover
        }
      };

      const res = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: newConfig })
      });

      if (res?.success) {
        setActivated(true);
        toast.success('¡Botón de WhatsApp activado en tu tienda!');
      } else {
        toast.error('No se pudo activar. Probá desde el módulo Style.');
      }
    } catch (err) {
      toast.error('Error de conexión. Probá de nuevo.');
    } finally {
      setActivating(false);
    }
  };

  // ============ NAVEGACIÓN A FEATURES ============
  const goToCountdown = () => {
    localStorage.setItem('gl_onboarding_done', '1');
    if (onClose) onClose();
    navigate('/countdown');
  };

  const goToSpinWheel = () => {
    localStorage.setItem('gl_onboarding_done', '1');
    if (onClose) onClose();
    navigate('/spin-wheel');
  };

  return (
    <div className="ow-overlay" role="dialog" aria-modal="true">
      <div className="ow-modal">
        {/* Header */}
        <button className="ow-close" onClick={skip} aria-label="Saltar onboarding">
          <X size={18} />
        </button>

        <div className="ow-header">
          <div className="ow-progress">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`ow-progress-dot ${step >= n ? 'active' : ''} ${step === n ? 'current' : ''}`}
              >
                {step > n ? <Check size={14} /> : n}
              </div>
            ))}
          </div>
          <p className="ow-step-label">Paso {step} de 3</p>
        </div>

        {/* Body */}
        <div className="ow-body">
          {/* ====== STEP 1: WHATSAPP ====== */}
          {step === 1 && (
            <>
              <div className="ow-icon-circle ow-icon-style">
                <Palette size={32} />
              </div>
              <h2 className="ow-title">Sumá un botón de WhatsApp a tu tienda</h2>
              <p className="ow-subtitle">
                En <strong>1 click</strong> tus clientes te van a poder escribir directo. Elegí un color y lo activamos.
              </p>

              <div className="ow-colors">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.bg}
                    className={`ow-color-card ${selectedColor.bg === c.bg ? 'selected' : ''}`}
                    onClick={() => setSelectedColor(c)}
                    type="button"
                  >
                    <div className="ow-color-bubble" style={{ background: c.bg }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </div>
                    <span className="ow-color-name">{c.name}</span>
                    {selectedColor.bg === c.bg && (
                      <div className="ow-color-check"><Check size={12} /></div>
                    )}
                  </button>
                ))}
              </div>

              <div className="ow-actions">
                <button className="ow-btn-secondary" onClick={skip}>Saltar tour</button>
                {!activated ? (
                  <button
                    className="ow-btn-primary"
                    onClick={activateWhatsapp}
                    disabled={activating}
                  >
                    {activating ? (
                      <><Loader size={16} className="ow-spin" /> Activando…</>
                    ) : (
                      <>Activar WhatsApp <ChevronRight size={16} /></>
                    )}
                  </button>
                ) : (
                  <button className="ow-btn-primary ow-btn-success" onClick={() => setStep(2)}>
                    <Check size={16} /> ¡Listo! Siguiente
                  </button>
                )}
              </div>
              {activated && (
                <p className="ow-success-hint">
                  ✨ Activado. Aparece en tu tienda en 1-2 minutos.
                </p>
              )}
            </>
          )}

          {/* ====== STEP 2: COUNTDOWN ====== */}
          {step === 2 && (
            <>
              <div className="ow-icon-circle ow-icon-countdown">
                <Clock size={32} />
              </div>
              <h2 className="ow-title">Generá urgencia con un countdown</h2>
              <p className="ow-subtitle">
                Mostrá una cuenta regresiva en tu tienda y aumentá la conversión hasta un <strong>30%</strong>. Ideal para Black Friday, lanzamientos o flash sales.
              </p>

              <div className="ow-feature-preview">
                <div className="ow-countdown-demo">
                  <div className="ow-cd-label">🔥 OFERTA TERMINA EN</div>
                  <div className="ow-cd-numbers">
                    <div><span>23</span><small>HS</small></div>
                    <div><span>45</span><small>MIN</small></div>
                    <div><span>12</span><small>SEG</small></div>
                  </div>
                </div>
              </div>

              <div className="ow-actions">
                <button className="ow-btn-secondary" onClick={() => setStep(3)}>
                  Saltar este paso
                </button>
                <button className="ow-btn-primary" onClick={goToCountdown}>
                  Crear mi primer countdown <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* ====== STEP 3: SPIN WHEEL ====== */}
          {step === 3 && (
            <>
              <div className="ow-icon-circle ow-icon-wheel">
                <Sparkles size={32} />
              </div>
              <h2 className="ow-title">Capturá emails con la ruleta de descuentos</h2>
              <p className="ow-subtitle">
                Tus visitantes giran la ruleta, dejan su email y se llevan un cupón único. Probado: <strong>+25% emails capturados</strong>.
              </p>

              <div className="ow-feature-preview">
                <div className="ow-wheel-demo">
                  <div className="ow-wheel">
                    <div className="ow-wheel-slice" style={{ '--rot': '0deg', '--bg': '#FF6B6B' }}>10% OFF</div>
                    <div className="ow-wheel-slice" style={{ '--rot': '60deg', '--bg': '#4ECDC4' }}>5% OFF</div>
                    <div className="ow-wheel-slice" style={{ '--rot': '120deg', '--bg': '#FFE66D' }}>Envío</div>
                    <div className="ow-wheel-slice" style={{ '--rot': '180deg', '--bg': '#A8E6CF' }}>15% OFF</div>
                    <div className="ow-wheel-slice" style={{ '--rot': '240deg', '--bg': '#C7B8EA' }}>Sorpresa</div>
                    <div className="ow-wheel-slice" style={{ '--rot': '300deg', '--bg': '#FFB6B9' }}>20% OFF</div>
                  </div>
                  <div className="ow-wheel-pointer">▼</div>
                </div>
              </div>

              <div className="ow-actions">
                <button className="ow-btn-secondary" onClick={finish}>
                  Terminar tour
                </button>
                <button className="ow-btn-primary" onClick={goToSpinWheel}>
                  Crear ruleta <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
