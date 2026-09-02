// Posiciones de home disponibles para los bloques de "Vidriera Shoppable".
// Cada `value` es un slot real del Nube SDK de TiendaNube (@tiendanube/nube-sdk-types),
// no un selector CSS - reemplaza el campo "Selector CSS (F12)" que usan los módulos viejos.
export const STOREFRONT_SLOTS = [
  { value: 'after_header', label: 'Justo debajo del header', group: 'Arriba de todo' },
  { value: 'before_main_content', label: 'Antes del contenido principal del home', group: 'Arriba de todo' },
  { value: 'before_section_products_sale', label: 'Antes de la sección de ofertas', group: 'Dentro del home' },
  { value: 'after_section_products_sale', label: 'Después de la sección de ofertas', group: 'Dentro del home' },
  { value: 'before_section_newsletter', label: 'Antes del newsletter', group: 'Dentro del home' },
  { value: 'after_section_newsletter', label: 'Después del newsletter', group: 'Dentro del home' },
  { value: 'after_main_content', label: 'Al final del contenido principal', group: 'Abajo' },
  { value: 'before_footer', label: 'Justo antes del pie de página', group: 'Abajo' },
  { value: 'corner_bottom_right', label: 'Esquina inferior derecha (flotante)', group: 'Flotante' },
  { value: 'corner_bottom_left', label: 'Esquina inferior izquierda (flotante)', group: 'Flotante' },
];

export const STOREFRONT_SLOT_GROUPS = [...new Set(STOREFRONT_SLOTS.map((s) => s.group))];

export function getSlotLabel(value) {
  return STOREFRONT_SLOTS.find((s) => s.value === value)?.label || value;
}
