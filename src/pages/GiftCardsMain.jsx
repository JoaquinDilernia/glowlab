import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Package, Gift, Palette } from 'lucide-react';
import './GiftCardsMain.css';

// PÁGINA PRINCIPAL - SUPER SIMPLE como "gifty"
// Solo 3 secciones: Mis Gift Cards, Cupones, Templates

function GiftCardsMain() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('products'); // products, coupons, templates

  return (
    <div className="gift-cards-main">
      {/* Header Simple */}
      <div className="main-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} />
          Dashboard
        </button>
        
        <h1>🎁 Gift Cards</h1>
        
        {activeView === 'products' && (
          <button className="btn-create-primary" onClick={() => navigate('/create-gift-card')}>
            <Plus size={20} />
            Nueva Gift Card
          </button>
        )}
        
        {activeView === 'templates' && (
          <button className="btn-create-primary" onClick={() => navigate('/gift-card-templates/create')}>
            <Plus size={20} />
            Nuevo Diseño
          </button>
        )}
      </div>

      {/* Navegación Simple - 3 Opciones */}
      <div className="simple-nav">
        <button 
          className={`nav-tab ${activeView === 'products' ? 'active' : ''}`}
          onClick={() => setActiveView('products')}
        >
          <Package size={18} />
          Mis Gift Cards
        </button>
        
        <button 
          className={`nav-tab ${activeView === 'coupons' ? 'active' : ''}`}
          onClick={() => setActiveView('coupons')}
        >
          <Gift size={18} />
          Cupones Generados
        </button>
        
        <button 
          className={`nav-tab ${activeView === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveView('templates')}
        >
          <Palette size={18} />
          Diseños
        </button>
      </div>

      {/* Contenido Según Vista */}
      <div className="main-content">
        {activeView === 'products' && <ProductsView />}
        {activeView === 'coupons' && <CouponsView />}
        {activeView === 'templates' && <TemplatesView />}
      </div>
    </div>
  );
}

// Vista 1: Productos Gift Card (lo que se vende)
function ProductsView() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/giftcard-products?storeId=${storeId}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="empty-state-clean">
        <Package size={64} style={{ color: '#cbd5e1' }} />
        <h3>No hay gift cards todavía</h3>
        <p>Creá tu primer producto para empezar a vender</p>
        <button 
          className="btn-create-empty"
          onClick={() => navigate('/create-gift-card')}
        >
          <Plus size={20} />
          Crear Primera Gift Card
        </button>
      </div>
    );
  }

  return (
    <div className="products-table">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Monto</th>
            <th>Validez</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.productId}>
              <td>
                <div className="product-name">
                  <Package size={18} />
                  Gift Card {formatCurrency(product.amount)}
                </div>
              </td>
              <td className="text-bold">{formatCurrency(product.amount)}</td>
              <td>{Math.floor(product.expiresInDays / 30)} meses</td>
              <td>
                {product.createdAt 
                  ? new Date(product.createdAt._seconds * 1000).toLocaleDateString('es-AR')
                  : '-'
                }
              </td>
              <td>
                <button 
                  className="btn-link"
                  onClick={() => window.open(`https://www.tiendanube.com/admin/products/${product.productId}`, '_blank')}
                >
                  Ver en TiendaNube →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Vista 2: Cupones Generados (cuando clientes compran)
function CouponsView() {
  const storeId = localStorage.getItem('promonube_store_id');
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      const response = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/giftcards?storeId=${storeId}`);
      const data = await response.json();
      
      if (data.success) {
        setCoupons(data.giftCards || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status, balance) => {
    if (balance <= 0) return <span className="badge-used">Usado</span>;
    if (status === 'active') return <span className="badge-active">Activo</span>;
    return <span className="badge-inactive">{status}</span>;
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (coupons.length === 0) {
    return (
      <div className="empty-state-clean">
        <Gift size={64} style={{ color: '#cbd5e1' }} />
        <h3>No hay cupones generados</h3>
        <p>Cuando un cliente compre una gift card, aparecerá aquí</p>
      </div>
    );
  }

  return (
    <div className="coupons-table">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Saldo</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Vence</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map(coupon => (
            <tr key={coupon.code}>
              <td>
                <code className="coupon-code">{coupon.code}</code>
              </td>
              <td className="text-bold">{formatCurrency(coupon.balance)}</td>
              <td>{coupon.recipientEmail || coupon.recipientName || '-'}</td>
              <td>{getStatusBadge(coupon.status, coupon.balance)}</td>
              <td>
                {coupon.expiresAt 
                  ? new Date(coupon.expiresAt._seconds * 1000).toLocaleDateString('es-AR')
                  : '-'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Vista 3: Templates/Diseños
function TemplatesView() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/giftcard-templates?storeId=${storeId}`);
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTemplates = async () => {
    if (!confirm('¿Crear 4 diseños predeterminados listos para usar?')) return;
    
    setCreating(true);
    
    const defaultTemplates = [
      { name: 'Elegante Negro', backgroundColor: '#1a1a1a', textColor: '#FFFFFF', isDefault: false },
      { name: 'Dorado Premium', backgroundColor: '#d4af37', textColor: '#1a1a1a', isDefault: true },
      { name: 'Azul Moderno', backgroundColor: '#0ea5e9', textColor: '#FFFFFF', isDefault: false },
      { name: 'Rosa Festivo', backgroundColor: '#ec4899', textColor: '#FFFFFF', isDefault: false }
    ];
    
    try {
      for (const template of defaultTemplates) {
        await fetch('https://apipromonube-jlfopowzaq-uc.a.run.app/api/giftcard-templates/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: storeId, // Usar el storeId real
            name: template.name,
            category: 'Predeterminado',
            backgroundColor: template.backgroundColor,
            textColor: template.textColor,
            textPosition: 'center',
            fontSize: 48,
            isPredefined: true,
            isDefault: template.isDefault
          })
        });
      }
      
      alert('✅ 4 diseños predeterminados creados!');
      loadTemplates();
    } catch (error) {
      alert('❌ Error al crear diseños predeterminados');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="empty-state-clean">
        <Palette size={64} style={{ color: '#cbd5e1' }} />
        <h3>No hay diseños todavía</h3>
        <p>Creá diseños predeterminados o uno personalizado</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <button 
            className="btn-create-empty"
            onClick={createDefaultTemplates}
            disabled={creating}
            style={{ background: '#0ea5e9' }}
          >
            {creating ? 'Creando...' : '✨ Crear 4 Predeterminados'}
          </button>
          <button 
            className="btn-create-empty"
            onClick={() => navigate('/gift-card-templates/create')}
          >
            <Plus size={20} />
            Crear Diseño Personalizado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="templates-grid-clean">
      {templates.map(template => (
        <div key={template.templateId} className="template-card-clean">
          <div 
            className="template-preview-clean"
            style={{ backgroundImage: `url(${template.imageUrl})` }}
          >
            {template.isDefault && (
              <span className="badge-default-clean">Por defecto</span>
            )}
          </div>
          <div className="template-info-clean">
            <h4>{template.name}</h4>
            {template.category && (
              <span className="category-tag">{template.category}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default GiftCardsMain;
