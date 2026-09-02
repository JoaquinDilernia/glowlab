import { useState } from 'react';
import { apiRequest } from '../config';

// Búsqueda de producto + normalización, extraído de ShopTheLookConfig.jsx
// para reutilizar entre los bloques de Vidriera Shoppable (grid, carousel, combo, quiz).
function formatPrice(p) {
  if (!p) return '';
  const num = parseFloat(String(p).replace(',', '.'));
  if (isNaN(num)) return `$${p}`;
  const hasDecimals = num % 1 !== 0;
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: hasDecimals ? 2 : 0 });
}

export function normalizeProduct(product) {
  const name = typeof product.name === 'object' ? (product.name.es || Object.values(product.name)[0]) : product.name;
  const handle = typeof product.handle === 'object' ? (product.handle.es || Object.values(product.handle)[0]) : product.handle;
  const image = product.images && product.images[0] ? (product.images[0].src || product.images[0]) : '';
  const variant = product.variants && product.variants[0] ? product.variants[0] : null;
  const price = variant ? variant.price : '';
  const productUrl = handle ? `/productos/${handle}` : '';

  return {
    productId: String(product.id),
    variantId: variant ? String(variant.id) : '',
    productName: name || '',
    productImage: image,
    productPrice: formatPrice(price),
    productUrl,
  };
}

export function useProductPicker(storeId) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (q) => {
    setQuery(q);
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const resp = await apiRequest(`/api/tiendanube/products/search?storeId=${storeId}&q=${encodeURIComponent(q)}`);
      const arr = Array.isArray(resp) ? resp : (resp.products || []);
      setResults(arr);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setQuery(''); setResults([]); };

  return { query, results, loading, search, reset, normalizeProduct };
}
