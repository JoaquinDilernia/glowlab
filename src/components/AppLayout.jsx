import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import './AppLayout.css';

function AppLayout() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!storeId) navigate('/');
  }, []);

  if (!storeId) return null;

  return (
    <div className="app-layout">
      {/* Mobile hamburger trigger */}
      <button
        className="sidebar-mobile-trigger"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Overlay when sidebar is open on mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Page content */}
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;
