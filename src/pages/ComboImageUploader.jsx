import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Upload } from 'lucide-react';
import { apiRequest } from '../config';

const MAX_COMBO_IMAGES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 800;
const MAX_SIDE = 1200;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No pudimos leer "${file.name}".`));
    img.src = URL.createObjectURL(file);
  });
}

// Valida peso, formato y tamaño, y la achica a 1200 px antes de subirla
// (el servidor ademas la pasa a WebP).
async function prepareComboImage(file) {
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    throw new Error(`"${file.name}" pesa ${mb} MB. Subí una de hasta 5 MB.`);
  }
  if (!TYPES.includes(file.type)) throw new Error(`"${file.name}" no es JPG, PNG o WebP.`);
  const img = await loadImage(file);
  const { width, height } = img;
  URL.revokeObjectURL(img.src);
  if (Math.min(width, height) < MIN_SIDE) {
    throw new Error(`"${file.name}" mide ${width} × ${height} px. El mínimo es ${MIN_SIDE} × ${MIN_SIDE} px.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height, square: width === height };
}

export default function ComboImageUploader({ storeId, images, onChange }) {
  const input = useRef(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [uploading, setUploading] = useState(false);

  const upload = async (files) => {
    setError('');
    setWarning('');
    const room = MAX_COMBO_IMAGES - images.length;
    const picked = [...files].slice(0, room);
    if (files.length > room) setWarning(`Se pueden subir hasta ${MAX_COMBO_IMAGES} fotos por combo.`);
    let next = images;
    setUploading(true);
    try {
      for (const file of picked) {
        const prepared = await prepareComboImage(file);
        if (!prepared.square) setWarning('La foto no es cuadrada: en la grilla se recorta al centro.');
        const res = await apiRequest('/api/upload-image-base64', {
          method: 'POST',
          body: JSON.stringify({ storeId, fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg', fileData: prepared.dataUrl, folder: 'combos' }),
        });
        if (!res?.success || !res.url) throw new Error(`No pudimos subir "${file.name}".`);
        next = [...next, res.url];
        onChange(next);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  const move = (i, dir) => {
    const next = images.slice();
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <div className="cb-uploader">
      <div className="cb-images">
        {images.map((src, i) => (
          <div key={src} className="cb-image" style={{ backgroundImage: `url("${src}")` }}>
            {i === 0 && <em>Principal</em>}
            <div className="cb-image-actions">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Mover a la izquierda"><ChevronLeft size={14} /></button>
              <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Mover a la derecha"><ChevronRight size={14} /></button>
              <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label="Quitar foto"><X size={14} /></button>
            </div>
          </div>
        ))}
        {images.length < MAX_COMBO_IMAGES && (
          <button type="button" className="cb-image cb-image--add" onClick={() => input.current?.click()} disabled={uploading}>
            <Upload size={18} />
            <span>{uploading ? 'Subiendo…' : 'Subir foto'}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={e => e.target.files?.length && upload(e.target.files)} />
      <p className="cb-rule">
        <strong>Tamaño recomendado: 1200 × 1200 px (cuadrada).</strong> Mínimo 800 × 800 px. JPG, PNG o WebP de hasta 5 MB.
        Se convierte sola a un WebP liviano. La primera foto es la principal. Si no subís fotos, se usan las de los productos del combo.
      </p>
      {warning && <p className="cb-rule cb-rule--warn">{warning}</p>}
      {error && <p className="cb-rule cb-rule--error">{error}</p>}
    </div>
  );
}
