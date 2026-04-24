import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, DollarSign, Calendar, Trash2, ExternalLink } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './GiftCardProducts.css';

function GiftCardProducts() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcard-products?storeId=${storeId}`);
      
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto? Esto no afectará códigos ya generados.')) {
      return;
    }

    try {
      const data = await apiRequest(`/api/giftcard-products/${productId}`, {
        method: 'DELETE',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        toast.success('Producto eliminado');
        loadProducts();
      } else {
        toast.error('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar producto');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp._seconds 
      ? new Date(timestamp._seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('es-AR');
  };

  if (loading) {
    return (
      <div className="gift-card-products-page">
        <div className="loading">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="gift-card-products-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/gift-cards')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-content">
          <div className="header-icon">
            <Package size={32} />
          </div>
          <div>
            <h1>Gift Cards - Productos</h1>
            <p>Administra los productos de gift cards en tu tienda</p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="empty-state">
          <Package size={64} />
          <h2>No hay productos de gift cards</h2>
          <p>Crea un producto gift card para que tus clientes puedan comprarlos</p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/create-gift-card')}
          >
            + Crear Producto Gift Card
          </button>
        </div>
      )}

      {/* Products Grid */}
      {products.length > 0 && (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.productId} className="product-card">
              <div className="product-header">
                <div className="product-icon">
                  <Package size={24} />
                </div>
                <div className="product-actions">
                  <button
                    className="btn-icon"
                    onClick={() => window.open(`https://www.tiendanube.com/admin/products/${product.productId}`, '_blank')}
                    title="Ver en TiendaNube"
                  >
                    <ExternalLink size={18} />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(product.productId)}
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="product-content">
                <h3 className="product-title">Gift Card {formatCurrency(product.amount)}</h3>

                <div className="product-details">
                  <div className="detail-row">
                    <DollarSign size={16} />
                    <span>Monto: <strong>{formatCurrency(product.amount)}</strong></span>
                  </div>

                  {product.expiresInDays && (
                    <div className="detail-row">
                      <Calendar size={16} />
                      <span>Vencimiento: <strong>{Math.floor(product.expiresInDays / 30)} meses</strong></span>
                    </div>
                  )}

                  <div className="detail-row">
                    <Package size={16} />
                    <span>Producto ID: <strong>#{product.productId}</strong></span>
                  </div>
                </div>

                <div className="product-footer">
                  <span className="product-date">
                    Creado el {formatDate(product.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GiftCardProducts;
