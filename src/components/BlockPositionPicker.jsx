import { STOREFRONT_SLOTS, STOREFRONT_SLOT_GROUPS } from '../constants/nubeSlots';

export default function BlockPositionPicker({ value, onChange, label = '¿Dónde aparece en el home?' }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          fontSize: '15px',
          background: '#fff'
        }}
      >
        <option value="" disabled>Elegí una posición...</option>
        {STOREFRONT_SLOT_GROUPS.map((group) => (
          <optgroup key={group} label={group}>
            {STOREFRONT_SLOTS.filter((s) => s.group === group).map((slot) => (
              <option key={slot.value} value={slot.value}>{slot.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <p style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
        Elegí de la lista, no hace falta buscar nada en el código de tu tienda.
      </p>
    </div>
  );
}
