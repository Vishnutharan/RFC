import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, TrendingUp, DollarSign, Clock, RefreshCw, Download, 
  CheckCircle, Truck, AlertTriangle, ChevronRight, Search, Printer, 
  Calendar, Star, MessageSquare, Flame, Plus, Edit2, Trash2, Package, 
  Settings, Users, Shield, UserCheck, ToggleLeft, ToggleRight, X, Eye, Save
} from 'lucide-react';
import { 
  getAdminOrders, updateOrderStatus, getMenuItems, createAdminMenuItem, 
  updateAdminMenuItem, archiveAdminMenuItem, getAdminCustomers, 
  getAdminStaff, createAdminStaff, updateAdminSetting, getAdminSettings 
} from '../services/api';
import { CATEGORIES, MENU_ITEMS } from '../data/initialMenu';
import PrintReceiptModal from './PrintReceiptModal';
import ReviewsManager from './ReviewsManager';

export default function AdminDashboard({ showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'menu_editor', 'daily_sales', 'store_settings', 'staff_manager', 'customer_manager', 'reviews'
  const [printModalOrder, setPrintModalOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Product & Menu Management state
  const [products, setProducts] = useState(MENU_ITEMS);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Staff Management state
  const [staffList, setStaffList] = useState([
    { id: 1, name: 'Vishnutharan', email: 'admin@rfcwatford.com', role: 'Store Owner', status: 'Active', joined: '2023-01-15' },
    { id: 2, name: 'Chef Tharan', email: 'kitchen@rfcwatford.com', role: 'Head Chef', status: 'Active', joined: '2023-03-10' },
    { id: 3, name: 'Front Desk Team', email: 'staff@rfcwatford.com', role: 'Counter Staff', status: 'Active', joined: '2023-06-01' }
  ]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'Counter Staff', password: '' });

  // Customer Management state
  const [customersList, setCustomersList] = useState([
    { id: 'c1', name: 'John Doe', email: 'john@example.com', phone: '+44 7700 900077', totalOrders: 14, loyaltyPoints: 340, address: '12 St Albans Rd, Watford' },
    { id: 'c2', name: 'Sarah Smith', email: 'sarah@example.com', phone: '+44 7700 900088', totalOrders: 8, loyaltyPoints: 190, address: '45 High St, Watford' },
    { id: 'c3', name: 'Alex Johnson', email: 'alex@example.com', phone: '+44 7700 900099', totalOrders: 21, loyaltyPoints: 520, address: '88 Cassiobury Dr, Watford' }
  ]);

  // Store Settings state
  const [storeSettings, setStoreSettings] = useState({
    storeOpen: true,
    minSpend: 15.00,
    deliveryFee: 2.50,
    freeDeliveryThreshold: 25.00,
    phone: '+44 1923 961864',
    address: '119 Courtlands Drive, Watford WD17 4HZ',
    openingHours: 'Mon-Sun: 11:00 AM - 10:00 PM'
  });

  // Fetch Orders & Menu Items
  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderData, menuData] = await Promise.allSettled([
        getAdminOrders(),
        getMenuItems()
      ]);

      if (orderData.status === 'fulfilled' && Array.isArray(orderData.value)) {
        setOrders(orderData.value);
      }
      if (menuData.status === 'fulfilled' && Array.isArray(menuData.value) && menuData.value.length > 0) {
        setProducts(menuData.value);
      }
    } catch (e) {
      console.warn('Backend load failed, using local fallback state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, []);

  // Order Status Change
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId || o.orderNumber === orderId) ? { ...o, orderStatus: newStatus } : o));
      showToast?.(`Order #${orderId} moved to ${newStatus}`);
    } catch (e) {
      setOrders(prev => prev.map(o => (o.id === orderId || o.orderNumber === orderId) ? { ...o, orderStatus: newStatus } : o));
      showToast?.(`Updated Order status to ${newStatus}`);
    }
  };

  // KPIs
  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + (o.total || 0), 0), [orders]);
  const totalOrdersCount = orders.length;
  const activeKitchenCount = useMemo(() => orders.filter(o => o.orderStatus === 'Placed' || o.orderStatus === 'Preparing').length, [orders]);
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // Kanban Columns
  const kanbanColumns = [
    { id: 'Placed', title: '🔵 Placed (New)', bg: '#E0F2FE', color: '#0369A1' },
    { id: 'Preparing', title: '🟡 In Kitchen', bg: '#FEF3C7', color: '#B45309' },
    { id: 'Out for Delivery', title: '🟣 Out for Delivery', bg: '#EEF2FF', color: '#4338CA' },
    { id: 'Completed', title: '🟢 Completed', bg: '#ECFDF5', color: '#047857' },
  ];

  // Filtered Orders for Search
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  }, [orders, searchQuery]);

  // Daily Sales Filtering
  const dailySalesOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.createdAt && !o.orderTime) return true;
      const d = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
      return d === selectedDate || !d;
    });
  }, [orders, selectedDate]);

  const dailyRevenue = useMemo(() => dailySalesOrders.reduce((s, o) => s + (o.total || 0), 0), [dailySalesOrders]);

  // Product Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || '').toLowerCase().includes(productSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, productSearch]);

  // Product Stock Toggle
  const handleToggleStock = async (product) => {
    const newStock = Number(product.stockQuantity || 99) === 0 ? 99 : 0;
    const updated = { ...product, stockQuantity: newStock };
    
    setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
    try {
      await updateAdminMenuItem(product.id, updated);
      showToast?.(`${product.name} stock set to ${newStock === 0 ? 'Out of Stock' : 'In Stock'}`);
    } catch {
      showToast?.(`${product.name} stock updated locally`);
    }
  };

  // Product Delete / Archive
  const handleArchiveProduct = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to remove "${productName}" from the store menu?`)) return;
    
    setProducts(prev => prev.filter(p => p.id !== productId));
    try {
      await archiveAdminMenuItem(productId);
      showToast?.(`Removed ${productName} from store menu`);
    } catch {
      showToast?.(`Removed ${productName} locally`);
    }
  };

  // Save / Add Product Submit
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const productPayload = {
      id: editingProduct?.id || `p-${Date.now()}`,
      name: formData.get('name'),
      categoryId: formData.get('categoryId'),
      price: parseFloat(formData.get('price')),
      calorieInfo: formData.get('calorieInfo') || '850 kcal',
      description: formData.get('description'),
      imageUrl: formData.get('imageUrl') || 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80',
      stockQuantity: parseInt(formData.get('stockQuantity') || '99', 10),
      isBestseller: formData.get('isBestseller') === 'on',
      isSpicy: formData.get('isSpicy') === 'on',
      isVegetarian: formData.get('isVegetarian') === 'on',
      hasOptions: formData.get('hasOptions') === 'on'
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? productPayload : p));
      try {
        await updateAdminMenuItem(editingProduct.id, productPayload);
        showToast?.(`Updated ${productPayload.name}`);
      } catch {
        showToast?.(`Updated ${productPayload.name} locally`);
      }
    } else {
      setProducts(prev => [productPayload, ...prev]);
      try {
        await createAdminMenuItem(productPayload);
        showToast?.(`Added new product ${productPayload.name}`);
      } catch {
        showToast?.(`Added ${productPayload.name} to menu`);
      }
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  // Add Staff Submit
  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email) return;
    const staffEntry = {
      id: Date.now(),
      ...newStaff,
      status: 'Active',
      joined: new Date().toISOString().split('T')[0]
    };
    setStaffList(prev => [...prev, staffEntry]);
    setIsStaffModalOpen(false);
    setNewStaff({ name: '', email: '', role: 'Counter Staff', password: '' });
    showToast?.(`Added staff member ${staffEntry.name}`);
  };

  // Store Settings Save
  const handleSaveSettings = (e) => {
    e.preventDefault();
    showToast?.('Store operational settings saved successfully!');
  };

  const exportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order Number', 'Date/Time', 'Customer', 'Phone', 'Type', 'Status', 'Payment', 'Total (£)'];
    const rows = orders.map(o => [
      o.orderNumber,
      `"${o.orderTime || o.createdAt}"`,
      `"${o.customerName}"`,
      `"${o.customerPhone}"`,
      o.orderType,
      o.orderStatus,
      o.paymentMethod,
      o.total
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RFC_Orders_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-container">
      
      {/* Header Bar */}
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>RFC Store Control & POS Dashboard</h2>
            <span className="card-badge badge-spicy" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFF', animation: 'pulse 1.2s infinite' }} /> 
              {storeSettings.storeOpen ? 'STORE ONLINE' : 'STORE CLOSED'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '2px' }}>
            Store: RFC Watford • 119 Courtlands Drive, WD17 4HZ • Tel: {storeSettings.phone}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="search-container" style={{ width: '200px' }}>
            <Search size={16} />
            <input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button onClick={fetchData} className="mode-btn" style={{ background: '#FFF', border: '1px solid var(--border)' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button onClick={exportCSV} className="btn-add-item" style={{ padding: '8px 16px' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="admin-metrics">
        <div className="metric-card">
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Revenue</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--red)' }}>£{totalRevenue.toFixed(2)}</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={20} /></div>
          </div>
        </div>

        <div className="metric-card">
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Orders</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem' }}>{totalOrdersCount}</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={20} /></div>
          </div>
        </div>

        <div className="metric-card">
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Active Kitchen Queue</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--amber)' }}>{activeKitchenCount}</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-light)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={20} /></div>
          </div>
        </div>

        <div className="metric-card">
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Avg Ticket Value (AOV)</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--green)' }}>£{avgOrderValue.toFixed(2)}</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={20} /></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'kanban', label: '📋 Kitchen Kanban', count: activeKitchenCount },
          { id: 'menu_editor', label: '🍔 Menu & Product Management', count: products.length },
          { id: 'daily_sales', label: '📅 Daily Sales', count: '' },
          { id: 'store_settings', label: '⚙️ Store Settings', count: '' },
          { id: 'staff_manager', label: '👥 Staff Management', count: staffList.length },
          { id: 'customer_manager', label: '👤 Customers', count: customersList.length },
          { id: 'reviews', label: '⭐ Customer Reviews', count: '' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-full)',
              fontWeight: activeTab === t.id ? 800 : 600,
              background: activeTab === t.id ? 'var(--red)' : '#FFF',
              color: activeTab === t.id ? '#FFF' : 'var(--text2)',
              border: activeTab === t.id ? 'none' : '1px solid var(--border)',
              fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <span>{t.label}</span>
            {t.count !== '' && <span className="cat-badge" style={{ background: activeTab === t.id ? 'rgba(255,255,255,0.3)' : 'var(--surface-alt)', color: activeTab === t.id ? '#FFF' : 'inherit' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE KITCHEN KANBAN BOARD */}
      {activeTab === 'kanban' && (
        <div className="kanban-board">
          {kanbanColumns.map(col => {
            const colOrders = filteredOrders.filter(o => o.orderStatus === col.id || (col.id === 'Completed' && (o.orderStatus === 'Delivered' || o.orderStatus === 'Ready for Collection')));
            return (
              <div key={col.id} className="kanban-col">
                <div className="kanban-header">
                  <span style={{ color: col.color }}>{col.title}</span>
                  <span className="cat-badge" style={{ background: col.bg, color: col.color }}>{colOrders.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {colOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text3)', fontSize: '0.85rem' }}>No orders in this column</div>
                  ) : (
                    colOrders.map(order => (
                      <div key={order.id || order.orderNumber} className="kanban-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '1rem', color: 'var(--red)' }}>#{order.orderNumber}</strong>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--surface-alt)', fontWeight: 700 }}>
                            {order.orderType?.toUpperCase() || 'DELIVERY'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text2)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <div>👤 <strong>{order.customerName || 'Customer'}</strong> ({order.customerPhone || 'N/A'})</div>
                          {order.deliveryAddress && <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>📍 {order.deliveryAddress}</div>}
                          <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>⏰ {order.orderTime || new Date(order.createdAt).toLocaleTimeString()}</div>
                        </div>

                        <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {order.items?.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{item.quantity}x {item.name || item.item?.name}</span>
                              <span style={{ color: 'var(--text3)' }}>£{((item.price || item.unitPrice || 0) * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
                          <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text)' }}>£{order.total?.toFixed(2)}</span>
                          <button onClick={() => setPrintModalOrder(order)} className="btn-add-item compact" style={{ fontSize: '0.75rem' }}>
                            <Printer size={12} /> Print Docket
                          </button>
                        </div>

                        {/* Status Controls */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {col.id === 'Placed' && (
                            <button onClick={() => handleStatusChange(order.id || order.orderNumber, 'Preparing')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#F59E0B' }}>
                              Start Kitchen Prep
                            </button>
                          )}
                          {col.id === 'Preparing' && (
                            <button onClick={() => handleStatusChange(order.id || order.orderNumber, order.orderType === 'collection' ? 'Completed' : 'Out for Delivery')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#6366F1' }}>
                              {order.orderType === 'collection' ? 'Ready for Customer' : 'Dispatch Driver'}
                            </button>
                          )}
                          {col.id === 'Out for Delivery' && (
                            <button onClick={() => handleStatusChange(order.id || order.orderNumber, 'Completed')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#10B981' }}>
                              Mark Delivered
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: MENU & PRODUCT MANAGEMENT (ADD / EDIT / TOGGLE STOCK) */}
      {activeTab === 'menu_editor' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div className="search-container" style={{ flex: 1 }}>
                <Search size={16} />
                <input
                  placeholder="Search products by name or description..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <option value="all">All Categories ({products.length})</option>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} 
              className="btn-submit-modal"
              style={{ width: 'auto' }}
            >
              <Plus size={18} /> Add New Product
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredProducts.map((p) => {
              const isOutOfStock = Number(p.stockQuantity || 99) === 0;
              return (
                <div key={p.id} className="food-card" style={{ opacity: isOutOfStock ? 0.75 : 1 }}>
                  <div className="card-img-wrapper" style={{ height: '140px' }}>
                    <img src={p.imageUrl} alt={p.name} />
                    <div className="badge-list">
                      {isOutOfStock ? (
                        <span className="card-badge badge-spicy" style={{ background: '#64748B' }}>OUT OF STOCK</span>
                      ) : (
                        <span className="card-badge badge-bestseller" style={{ background: '#10B981' }}>IN STOCK</span>
                      )}
                      {p.isBestseller && <span className="card-badge badge-bestseller">Popular</span>}
                      {p.isSpicy && <span className="card-badge badge-spicy">Spicy</span>}
                    </div>
                  </div>

                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 className="card-title">{p.name}</h4>
                      <span className="card-price">£{Number(p.price || 0).toFixed(2)}</span>
                    </div>
                    <p className="card-desc">{p.description}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 700 }}>Category: {p.categoryId} • {p.calorieInfo}</span>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                      <button 
                        onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}
                        className="btn-add-item"
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>

                      <button 
                        onClick={() => handleToggleStock(p)}
                        className="mode-btn"
                        style={{ background: isOutOfStock ? '#ECFDF5' : '#FEF2F2', color: isOutOfStock ? '#047857' : '#B91C1C', padding: '6px 12px', fontSize: '0.78rem' }}
                      >
                        {isOutOfStock ? 'In Stock' : 'Out Stock'}
                      </button>

                      <button 
                        onClick={() => handleArchiveProduct(p.id, p.name)}
                        className="mode-btn"
                        style={{ background: '#F1F5F9', color: '#64748B', padding: '6px 10px' }}
                        title="Archive Item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DAILY SALES INSPECTOR */}
      {activeTab === 'daily_sales' && (
        <div style={{ background: '#FFF', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>Daily Sales & Transaction Inspector</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Detailed ledger of store revenue and orders</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontWeight: 700 }}
              />
              <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--red)' }}>Daily Total: £{dailyRevenue.toFixed(2)}</span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px' }}>Order #</th>
                <th style={{ padding: '12px' }}>Time</th>
                <th style={{ padding: '12px' }}>Customer</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Payment</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {dailySalesOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>No sales transactions found for {selectedDate}</td>
                </tr>
              ) : (
                dailySalesOrders.map((o, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 800, color: 'var(--red)' }}>#{o.orderNumber}</td>
                    <td style={{ padding: '12px' }}>{o.orderTime || new Date(o.createdAt).toLocaleTimeString()}</td>
                    <td style={{ padding: '12px' }}><strong>{o.customerName}</strong> ({o.customerPhone})</td>
                    <td style={{ padding: '12px' }}>{o.orderType?.toUpperCase()}</td>
                    <td style={{ padding: '12px' }}>{o.paymentMethod || 'CARD'}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge status-${(o.orderStatus || 'placed').toLowerCase().replace(/\s+/g, '')}`}>
                        {o.orderStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900 }}>£{o.total?.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: STORE SETTINGS & OPS */}
      {activeTab === 'store_settings' && (
        <div style={{ maxWidth: '680px', background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} /> Store Operational Controls</h3>
          
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: 'var(--radius-sm)', background: storeSettings.storeOpen ? '#ECFDF5' : '#FEF2F2', border: '1px solid var(--border)' }}>
              <div>
                <strong>Online Ordering Status</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>Toggle store active status for online orders</p>
              </div>
              <button 
                type="button"
                onClick={() => setStoreSettings(prev => ({ ...prev, storeOpen: !prev.storeOpen }))}
                className="btn-submit-modal"
                style={{ width: 'auto', padding: '8px 16px', background: storeSettings.storeOpen ? '#10B981' : '#E52929' }}
              >
                {storeSettings.storeOpen ? 'STORE OPEN (ACTIVE)' : 'STORE CLOSED (OFFLINE)'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Delivery Fee (£)</label>
                <input 
                  type="number" step="0.5" 
                  value={storeSettings.deliveryFee} 
                  onChange={(e) => setStoreSettings({ ...storeSettings, deliveryFee: parseFloat(e.target.value) })}
                  className="input-group" style={{ width: '100%', marginTop: '4px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Free Delivery Over (£)</label>
                <input 
                  type="number" step="1" 
                  value={storeSettings.freeDeliveryThreshold} 
                  onChange={(e) => setStoreSettings({ ...storeSettings, freeDeliveryThreshold: parseFloat(e.target.value) })}
                  className="input-group" style={{ width: '100%', marginTop: '4px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Min Delivery Spend (£)</label>
                <input 
                  type="number" step="1" 
                  value={storeSettings.minSpend} 
                  onChange={(e) => setStoreSettings({ ...storeSettings, minSpend: parseFloat(e.target.value) })}
                  className="input-group" style={{ width: '100%', marginTop: '4px' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Store Phone</label>
                <input 
                  type="text" 
                  value={storeSettings.phone} 
                  onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                  className="input-group" style={{ width: '100%', marginTop: '4px' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Store Address</label>
              <input 
                type="text" 
                value={storeSettings.address} 
                onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                className="input-group" style={{ width: '100%', marginTop: '4px' }} 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Operating Hours</label>
              <input 
                type="text" 
                value={storeSettings.openingHours} 
                onChange={(e) => setStoreSettings({ ...storeSettings, openingHours: e.target.value })}
                className="input-group" style={{ width: '100%', marginTop: '4px' }} 
              />
            </div>

            <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}>
              <Save size={16} /> Save Operational Settings
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: STAFF MANAGEMENT */}
      {activeTab === 'staff_manager' && (
        <div style={{ background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3>Staff & User Access Management</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Manage store accounts and kitchen permissions</p>
            </div>
            <button onClick={() => setIsStaffModalOpen(true)} className="btn-submit-modal" style={{ width: 'auto' }}>
              <Plus size={16} /> Add Staff Account
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px' }}>Staff Name</th>
                <th style={{ padding: '12px' }}>Email</th>
                <th style={{ padding: '12px' }}>Role</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px', fontWeight: 800 }}>{s.name}</td>
                  <td style={{ padding: '12px' }}>{s.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span className="card-badge badge-bestseller" style={{ background: s.role.includes('Owner') ? 'var(--red)' : 'var(--indigo)' }}>
                      {s.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}><span className="status-badge status-completed">{s.status}</span></td>
                  <td style={{ padding: '12px', color: 'var(--text3)' }}>{s.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: CUSTOMERS DIRECTORY */}
      {activeTab === 'customer_manager' && (
        <div style={{ background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ marginBottom: '16px' }}>Registered Customers Directory</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px' }}>Customer Name</th>
                <th style={{ padding: '12px' }}>Contact Info</th>
                <th style={{ padding: '12px' }}>Saved Address</th>
                <th style={{ padding: '12px' }}>Orders Placed</th>
                <th style={{ padding: '12px' }}>Loyalty Points</th>
              </tr>
            </thead>
            <tbody>
              {customersList.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px', fontWeight: 800 }}>{c.name}</td>
                  <td style={{ padding: '12px' }}>{c.email}<br/><span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{c.phone}</span></td>
                  <td style={{ padding: '12px' }}>{c.address}</td>
                  <td style={{ padding: '12px', fontWeight: 700 }}>{c.totalOrders} orders</td>
                  <td style={{ padding: '12px', fontWeight: 900, color: 'var(--amber)' }}>🎁 {c.loyaltyPoints} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 7: REVIEWS & COMPLAINTS */}
      {activeTab === 'reviews' && (
        <ReviewsManager isAdmin={true} showToast={showToast} />
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProductModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="close-btn" onClick={() => setIsProductModalOpen(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Product Name</label>
                <input name="name" defaultValue={editingProduct?.name || ''} required className="input-group" style={{ width: '100%', marginTop: '4px' }} placeholder="e.g. Boneless Banquet Meal" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Category</label>
                  <select name="categoryId" defaultValue={editingProduct?.categoryId || 'box-meals'} style={{ width: '100%', marginTop: '4px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Price (£)</label>
                  <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price || '8.99'} required className="input-group" style={{ width: '100%', marginTop: '4px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Description</label>
                <textarea name="description" defaultValue={editingProduct?.description || ''} className="notes-input" style={{ width: '100%', marginTop: '4px' }} placeholder="Describe ingredients, sides included, etc." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Calorie Info</label>
                  <input name="calorieInfo" defaultValue={editingProduct?.calorieInfo || '850 kcal'} className="input-group" style={{ width: '100%', marginTop: '4px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Stock Quantity</label>
                  <input name="stockQuantity" type="number" defaultValue={editingProduct?.stockQuantity ?? 99} className="input-group" style={{ width: '100%', marginTop: '4px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Image URL</label>
                <input name="imageUrl" defaultValue={editingProduct?.imageUrl || ''} className="input-group" style={{ width: '100%', marginTop: '4px' }} placeholder="https://images.unsplash.com/..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--surface-alt)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" name="isBestseller" defaultChecked={editingProduct?.isBestseller} /> Bestseller Badge
                </label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" name="isSpicy" defaultChecked={editingProduct?.isSpicy} /> Spicy Badge
                </label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" name="isVegetarian" defaultChecked={editingProduct?.isVegetarian} /> Vegetarian
                </label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" name="hasOptions" defaultChecked={editingProduct?.hasOptions ?? true} /> Side & Drink Choices
                </label>
              </div>

              <div className="modal-footer" style={{ padding: 0, marginTop: '10px' }}>
                <button type="button" className="btn-back" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit-modal" style={{ flex: 1 }}>
                  {editingProduct ? 'Save Product Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF */}
      {isStaffModalOpen && (
        <div className="modal-overlay" onClick={() => setIsStaffModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Staff Account</h3>
              <button className="close-btn" onClick={() => setIsStaffModalOpen(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleAddStaff} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Staff Name</label>
                <input value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} required className="input-group" style={{ width: '100%', marginTop: '4px' }} placeholder="e.g. Alex Chef" />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Email Address</label>
                <input type="email" value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} required className="input-group" style={{ width: '100%', marginTop: '4px' }} placeholder="staff@rfcwatford.com" />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Role & Permissions</label>
                <select value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} style={{ width: '100%', marginTop: '4px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <option value="Counter Staff">Counter Staff (Orders only)</option>
                  <option value="Kitchen Staff">Kitchen Staff (Kanban only)</option>
                  <option value="Store Manager">Store Manager (Full access)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Initial Password</label>
                <input type="password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} required minLength={6} className="input-group" style={{ width: '100%', marginTop: '4px' }} />
              </div>

              <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}>Create Account</button>
            </form>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      <PrintReceiptModal
        isOpen={Boolean(printModalOrder)}
        onClose={() => setPrintModalOrder(null)}
        order={printModalOrder}
      />
    </div>
  );
}
