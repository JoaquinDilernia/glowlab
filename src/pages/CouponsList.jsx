import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Download, Plus, Tag, Calendar, Users, DollarSign, Eye, EyeOff, Trash2, Filter, BarChart2, Zap, Mail, Gift, Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '../config';
import CouponUsageModal from '../components/CouponUsageModal';
import { useToast } from '../context/ToastContext';
import './CouponsList.css';

function CouponsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, percentage, absolute
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [filterUsage, setFilterUsage] = useState('all'); // all, unused, used, exhausted
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, mostUsed, leastUsed
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, []);

  useEffect(() => {
    filterCoupons();
  }, [searchTerm, filterType, filterStatus, filterUsage, sortBy, coupons]);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading coupons for storeId:', storeId);
      const data = await apiRequest(`/api/coupons?storeId=${storeId}`);
      
      console.log('📦 API Response:', data);
      
      if (data.success) {
        console.log('✅ Cupones encontrados:', data.coupons.length);
        setCoupons(data.coupons);
      } else {
        console.error('❌ Error en la respuesta:', data);
      }
    } catch (error) {
      console.error('❌ Error loading coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCoupons = () => {
    let filtered = [...coupons];

    // Búsqueda por código o descripción
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtro por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(c => c.type === filterType);
    }

    // Filtro por estado
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(c => c.active === isActive);
    }

    // Filtro por uso
    if (filterUsage !== 'all') {
      filtered = filtered.filter(c => {
        const uses = c.currentUses || 0;
        const maxUses = c.maxUses;
        
        if (filterUsage === 'unused') return uses === 0;
        if (filterUsage === 'used') return uses > 0 && (!maxUses || uses < maxUses);
        if (filterUsage === 'exhausted') return maxUses && uses >= maxUses;
        return true;
      });
    }

    // Ordenar
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'newest':
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        case 'oldest':
          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        case 'mostUsed':
          return (b.currentUses || 0) - (a.currentUses || 0);
        case 'leastUsed':
          return (a.currentUses || 0) - (b.currentUses || 0);
        default:
          return 0;
      }
    });

    setFilteredCoupons(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Código', 'Tipo', 'Valor', 'Monto Mínimo', 'Máx Descuento', 'Fecha Inicio', 'Fecha Fin', 'Máx Usos', 'Usos Actuales', 'Estado'];
    const rows = filteredCoupons.map(c => [
      c.code,
      c.type === 'percentage' ? 'Porcentaje' : 'Monto Fijo',
      c.type === 'percentage' ? `${c.value}%` : `$${c.value}`,
      c.minAmount ? `$${c.minAmount}` : '-',
      c.maxDiscount ? `$${c.maxDiscount}` : '-',
      c.startDate || '-',
      c.endDate || '-',
      c.maxUses || 'Ilimitado',
      c.currentUses || 0,
      c.active ? 'Activo' : 'Inactivo'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cupones-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const toggleCouponStatus = async (couponId, currentStatus) => {
    try {
      const data = await apiRequest(`/api/coupons/${couponId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        // Actualizar localmente
        setCoupons(prev => prev.map(c => 
          c.couponId === couponId ? { ...c, active: data.active } : c
        ));
        toast.success(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.info('Error al cambiar estado del cupón');
    }
  };

  const deleteCoupon = async (couponId) => {
    if (!window.confirm('¿Estás seguro de eliminar este cupón? Esta acción no se puede deshacer.')) return;
    
    try {
      const data = await apiRequest(`/api/coupons/${couponId}?storeId=${storeId}`, {
        method: 'DELETE'
      });

      if (data.success) {
        // Remover localmente
        setCoupons(prev => prev.filter(c => c.couponId !== couponId));
        toast.success(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.info('Error al eliminar cupón');
    }
  };

  const formatValue = (coupon) => {
    if (coupon.type === 'percentage') {
      return `${coupon.value}% OFF`;
    }
    return `$${coupon.value}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  const isExpired = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      const errors = [];
      const coupons = [];

      lines.forEach((line, index) => {
        if (index === 0) return; // Skip header
        
        const values = line.split(',').map(v => v.trim());
        
        if (values.length < 3) {
          errors.push({
            row: index + 1,
            message: 'Faltan columnas requeridas (Código, Tipo, Valor)'
          });
          return;
        }

        const [code, type, value, maxUses, startDate, endDate, description] = values;
        
        if (!code) {
          errors.push({ row: index + 1, message: 'Código vacío' });
          return;
        }

        const normalizedType = type.toLowerCase().includes('porcentaje') ? 'percentage' : 'absolute';
        const parsedValue = parseFloat(value);

        if (isNaN(parsedValue) || parsedValue <= 0) {
          errors.push({ row: index + 1, message: 'Valor inválido' });
          return;
        }

        coupons.push({
          code,
          type: normalizedType,
          value: parsedValue,
          maxUses: maxUses ? parseInt(maxUses) : null,
          startDate: startDate || null,
          endDate: endDate || null,
          description: description || '',
          active: true,
          storeId
        });
      });

      setCsvData(coupons);
      setCsvErrors(errors);
      setShowImportModal(true);
    };

    reader.readAsText(file);
  };

  const importCoupons = async () => {
    setImporting(true);
    try {
      const data = await apiRequest('/api/coupons/bulk', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          coupons: csvData
        })
      });

      if (data.success) {
        toast.success(`${data.imported} cupones importados correctamente`);
        setShowImportModal(false);
        setCsvData([]);
        setCsvErrors([]);
        loadCoupons();
      } else {
        toast.error(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error importing coupons:', error);
      toast.info('Error al importar cupones');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Cargando cupones...</p>
      </div>
    );
  }

  return (
    <div className="coupons-list-container">
      {/* Modern Header */}
      <header className="coupons-header-modern">
        <div className="header-content-wrapper">
          <div className="header-top">
            <div className="header-actions-modern">
              <button className="btn-secondary-modern" onClick={exportToCSV} disabled={filteredCoupons.length === 0}>
                <Download size={18} />
                <span>Exportar</span>
              </button>
              <label className="btn-secondary-modern">
                <Upload size={18} />
                <span>Importar</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="btn-primary-modern" onClick={() => navigate('/create-coupon')}>
                <Plus size={18} />
                <span>Crear Cupón</span>
              </button>
            </div>
          </div>
          <div className="header-info-modern">
            <h1 className="page-title-modern">📋 Mis Cupones</h1>
            <p className="page-subtitle-modern">
              {filteredCoupons.length} cupones encontrados
              {filterStatus !== 'all' && ` · ${filterStatus === 'active' ? 'Activos' : 'Inactivos'}`}
            </p>
          </div>
        </div>
      </header>

      {/* Modern Filters & Search */}
      <div className="filters-section-modern">
        <div className="search-box-modern">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar cupones por código o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-modern"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filters-bar-modern">
          <select 
            className="filter-select-modern" 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">📊 Todos los tipos</option>
            <option value="percentage">% Porcentaje</option>
            <option value="absolute">$ Monto Fijo</option>
          </select>

          <select 
            className="filter-select-modern" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">🎯 Todos los estados</option>
            <option value="active">✅ Activos</option>
            <option value="inactive">❌ Inactivos</option>
          </select>

          <select 
            className="filter-select-modern" 
            value={filterUsage} 
            onChange={(e) => setFilterUsage(e.target.value)}
          >
            <option value="all">📈 Todo el uso</option>
            <option value="unused">🆕 Sin usar</option>
            <option value="used">✓ Usados</option>
            <option value="exhausted">🚫 Agotados</option>
          </select>

          <select 
            className="filter-select-modern" 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">🕐 Más recientes</option>
            <option value="oldest">📅 Más antiguos</option>
            <option value="mostUsed">🔥 Más usados</option>
            <option value="leastUsed">💤 Menos usados</option>
          </select>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="coupons-grid">
        {filteredCoupons.length === 0 ? (
          <div className="empty-state">
            <Tag size={48} />
            <h3>No hay cupones</h3>
            <p>
              {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                ? 'No se encontraron cupones con estos filtros'
                : 'Creá tu primer cupón para empezar'}
            </p>
            {!searchTerm && filterType === 'all' && filterStatus === 'all' && (
              <button className="btn-create-empty" onClick={() => navigate('/create-coupon')}>
                <Plus size={20} />
                Crear Cupón
              </button>
            )}
          </div>
        ) : (
          filteredCoupons.map(coupon => (
            <div key={coupon.couponId} className={`coupon-card ${!coupon.active || isExpired(coupon.endDate) ? 'inactive' : ''}`}>
              {/* Header */}
              <div className="coupon-card-header">
                <div className="coupon-code">
                  <Tag size={18} />
                  <span>{coupon.code}</span>
                </div>
                <div className="coupon-status">
                  {isExpired(coupon.endDate) ? (
                    <span className="badge badge-expired">Vencido</span>
                  ) : (
                    <span className={`badge badge-${coupon.active ? 'active' : 'inactive'}`}>
                      {coupon.active ? 'Activo' : 'Inactivo'}
                    </span>
                  )}
                </div>
              </div>

              {/* Value */}
              <div className="coupon-value">
                {formatValue(coupon)}
              </div>

              {/* Description */}
              {coupon.description && (
                <p className="coupon-description">{coupon.description}</p>
              )}

              {/* Smart Features Badges */}
              {(coupon.restrictedEmail || coupon.freeProductId || coupon.maxDiscount) && (
                <div className="smart-features">
                  {coupon.maxDiscount && (
                    <span className="smart-badge tope">
                      <Zap size={12} /> Tope ${coupon.maxDiscount}
                    </span>
                  )}
                  {coupon.restrictedEmail && (
                    <span className="smart-badge email">
                      <Mail size={12} /> {coupon.restrictedEmail}
                    </span>
                  )}
                  {coupon.freeProductId && (
                    <span className="smart-badge gift">
                      <Gift size={12} /> {coupon.freeProductName || `Producto #${coupon.freeProductId}`}
                    </span>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="coupon-stats">
                {coupon.minAmount && (
                  <div className="stat-item">
                    <DollarSign size={14} />
                    <span>Mín: ${coupon.minAmount}</span>
                  </div>
                )}
                {coupon.maxUses && (
                  <div className="stat-item">
                    <Users size={14} />
                    <span>{coupon.currentUses || 0}/{coupon.maxUses}</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              {(coupon.startDate || coupon.endDate) && (
                <div className="coupon-dates">
                  <Calendar size={14} />
                  <span>
                    {coupon.startDate && formatDate(coupon.startDate)}
                    {coupon.startDate && coupon.endDate && ' - '}
                    {coupon.endDate && formatDate(coupon.endDate)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="coupon-actions">
                <button 
                  className="btn-action btn-primary"
                  onClick={() => navigate(`/coupon-analytics/${coupon.couponId}`)}
                  title="Ver analytics"
                >
                  <BarChart2 size={16} />
                </button>
                <button 
                  className="btn-action"
                  onClick={() => toggleCouponStatus(coupon.couponId, coupon.active)}
                  title={coupon.active ? 'Desactivar' : 'Activar'}
                >
                  {coupon.active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button 
                  className="btn-action btn-danger"
                  onClick={() => deleteCoupon(coupon.couponId)}
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Historial */}
      {selectedCoupon && (
        <CouponUsageModal 
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
        />
      )}

      {/* Modal de Importación CSV */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 Importar Cupones desde CSV</h2>
              <button className="btn-close" onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {csvErrors.length > 0 && (
                <div className="import-errors">
                  <div className="error-header">
                    <AlertCircle size={20} />
                    <h3>⚠️ {csvErrors.length} errores encontrados</h3>
                  </div>
                  <div className="error-list">
                    {csvErrors.map((error, idx) => (
                      <div key={idx} className="error-item">
                        <strong>Fila {error.row}:</strong> {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {csvData.length > 0 && (
                <div className="import-preview">
                  <div className="preview-header">
                    <CheckCircle size={20} />
                    <h3>✅ {csvData.length} cupones listos para importar</h3>
                  </div>
                  <div className="preview-table-wrapper">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Tipo</th>
                          <th>Valor</th>
                          <th>Máx Usos</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 10).map((coupon, idx) => (
                          <tr key={idx}>
                            <td><code>{coupon.code}</code></td>
                            <td>{coupon.type === 'percentage' ? '📊 Porcentaje' : '💵 Monto Fijo'}</td>
                            <td><strong>{coupon.value}{coupon.type === 'percentage' ? '%' : ''}</strong></td>
                            <td>{coupon.maxUses || '∞'}</td>
                            <td>{coupon.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvData.length > 10 && (
                      <p className="preview-note">Mostrando 10 de {csvData.length} cupones...</p>
                    )}
                  </div>
                </div>
              )}

              <div className="import-info">
                <h4>📋 Formato del archivo CSV:</h4>
                <ul>
                  <li><strong>Columnas requeridas:</strong> Código, Tipo, Valor</li>
                  <li><strong>Columnas opcionales:</strong> Máx Usos, Válido Desde, Válido Hasta, Descripción</li>
                  <li><strong>Tipo:</strong> "Porcentaje" o "Monto Fijo"</li>
                  <li><strong>Ejemplo:</strong> VERANO2024,Porcentaje,20,100,01/12/2024,31/12/2024,Descuento de verano</li>
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowImportModal(false);
                  setCsvData([]);
                  setCsvErrors([]);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={importCoupons}
                disabled={csvData.length === 0 || csvErrors.length > 0 || importing}
              >
                {importing ? (
                  <>
                    <div className="spinner-small"></div>
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Importar {csvData.length} Cupones
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CouponsList;
