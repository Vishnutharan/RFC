import { useCallback, useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, Download, Search, Printer, Plus, Edit2, Trash2,
  Settings, X, Save
} from 'lucide-react';
import { 
  getAdminOrders, updateOrderStatus, getAdminMenu, createAdminMenuItem,
  updateAdminMenuItem, archiveAdminMenuItem, getAdminCustomers, 
  getAdminStaff, createAdminStaff, updateAdminSetting, getAdminSettings 
} from '../services/api';
import { CATEGORIES } from '../data/initialMenu';
import PrintReceiptModal from './PrintReceiptModal';
import ReviewsManager from './ReviewsManager';

export default function AdminDashboard({ showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'menu_editor', 'sales_reports', 'orders_ledger', 'store_settings', 'staff_manager', 'customer_manager', 'reviews'
  const [printModalOrder, setPrintModalOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sales Reports State
  const [reportType, setReportType] = useState('daily'); // 'daily', 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Orders Ledger State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('All');

  // Product & Menu Management state
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Staff Management state
  const [staffList, setStaffList] = useState([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'staff', password: '' });

  // Customer Management state
  const [customersList, setCustomersList] = useState([]);

  // Store Settings state
  const [storeSettings, setStoreSettings] = useState({ openingHours: '' });

  // Fetch Orders & Menu Items
  const fetchData = useCallback(async ({ showSpinner = true, notifyOnError = true } = {}) => {
    if (showSpinner) setLoading(true);
    const results = await Promise.allSettled([
      getAdminOrders(),
      getAdminMenu(),
      getAdminCustomers(),
      getAdminStaff(),
      getAdminSettings()
    ]);
    const [orderData, menuData, customerData, staffData, settingsData] = results;

    if (orderData.status === 'fulfilled' && Array.isArray(orderData.value)) setOrders(orderData.value);
    if (menuData.status === 'fulfilled' && Array.isArray(menuData.value)) {
      setProducts(menuData.value.filter((item) => item.isAvailable !== false));
    }
    if (customerData.status === 'fulfilled' && Array.isArray(customerData.value)) setCustomersList(customerData.value);
    if (staffData.status === 'fulfilled' && Array.isArray(staffData.value)) setStaffList(staffData.value);
    if (settingsData.status === 'fulfilled' && Array.isArray(settingsData.value)) {
      const openingHours = settingsData.value.find((setting) => setting.key === 'OpeningHours');
      if (openingHours?.value) {
        try {
          setStoreSettings({ openingHours: JSON.stringify(JSON.parse(openingHours.value), null, 2) });
        } catch {
          setStoreSettings({ openingHours: openingHours.value });
        }
      }
    }

    const failureCount = results.filter((result) => result.status === 'rejected').length;
    if (failureCount > 0 && notifyOnError) {
      showToast?.(`Could not load ${failureCount} admin data source${failureCount === 1 ? '' : 's'}. Existing server-confirmed data was kept.`, 'error');
    }
    if (showSpinner) setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData({ showSpinner: false, notifyOnError: false }), 12000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Order Status Change
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId || o.orderNumber === orderId) ? { ...o, orderStatus: newStatus } : o));
      showToast?.(`Order #${orderId} moved to ${newStatus}`);
    } catch (e) {
      showToast?.(e.message || `Order #${orderId} could not be moved to ${newStatus}.`, 'error');
    }
  };

  // KPIs (Global)
  const activeKitchenCount = useMemo(() => orders.filter(o => o.orderStatus === 'Placed' || o.orderStatus === 'Preparing').length, [orders]);

  // Kanban Columns
  const kanbanColumns = [
    { id: 'Placed', title: '🔵 Placed (New)', bg: '#E0F2FE', color: '#0369A1' },
    { id: 'Preparing', title: '🟡 In Kitchen', bg: '#FEF3C7', color: '#B45309' },
    { id: 'Out for Delivery', title: '🟣 Out for Delivery', bg: '#EEF2FF', color: '#4338CA' },
    { id: 'Completed', title: '🟢 Completed', bg: '#ECFDF5', color: '#047857' },
  ];

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  }, [orders, searchQuery]);

  // Daily Sales Logic
  const dailySalesOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.createdAt && !o.orderTime) return false;
      const d = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
      return d === selectedDate;
    });
  }, [orders, selectedDate]);

  const dailyGross = dailySalesOrders.reduce((s, o) => s + (o.total || 0), 0);
  const dailyRefunds = dailySalesOrders.filter(o => o.orderStatus === 'Refunded').reduce((s, o) => s + (o.refundAmount || 0), 0);
  const dailyNet = dailyGross - dailyRefunds;
  const dailyCompleted = dailySalesOrders.filter(o => o.orderStatus === 'Completed').length;
  const dailyCompletedRate = dailySalesOrders.length ? ((dailyCompleted / dailySalesOrders.length) * 100).toFixed(1) : 0;
  const dailyAov = dailySalesOrders.length ? (dailyGross / dailySalesOrders.length).toFixed(2) : 0;

  // Monthly Sales Logic
  const monthlySalesOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const m = new Date(o.createdAt).toISOString().slice(0,7);
      return m === selectedMonth;
    });
  }, [orders, selectedMonth]);

  const monthlyGross = monthlySalesOrders.reduce((s, o) => s + (o.total || 0), 0);
  const monthlyRefunds = monthlySalesOrders.filter(o => o.orderStatus === 'Refunded').reduce((s, o) => s + (o.refundAmount || 0), 0);
  const monthlyNet = monthlyGross - monthlyRefunds;
  const monthlyAov = monthlySalesOrders.length ? (monthlyGross / monthlySalesOrders.length).toFixed(2) : 0;

  // Monthly Day-by-Day Aggregation
  const monthlyDays = useMemo(() => {
    const days = {};
    monthlySalesOrders.forEach(o => {
      const d = new Date(o.createdAt).toISOString().split('T')[0];
      if (!days[d]) days[d] = { date: d, orders: 0, gross: 0, refunds: 0, net: 0 };
      days[d].orders += 1;
      days[d].gross += (o.total || 0);
      if (o.orderStatus === 'Refunded') days[d].refunds += (o.refundAmount || 0);
      days[d].net = days[d].gross - days[d].refunds;
    });
    return Object.values(days).sort((a,b) => a.date.localeCompare(b.date));
  }, [monthlySalesOrders]);

  // Ledger Filter
  const ledgerOrders = useMemo(() => {
    let res = orders;
    if (ledgerFilter !== 'All') {
      res = res.filter(o => o.orderStatus === ledgerFilter);
    }
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      res = res.filter(o => 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q))
      );
    }
    return [...res].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, ledgerSearch, ledgerFilter]);


  // Product Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.description || '').toLowerCase().includes(productSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, productSearch]);

  const handleToggleStock = async (product) => {
    if (Number(product.stockCount ?? 0) <= 0) {
      setEditingProduct(product);
      setIsProductModalOpen(true);
      return;
    }
    const newStock = 0;
    const updated = { ...product, stockCount: newStock, isAvailable: product.isAvailable ?? true };
    try {
      const saved = await updateAdminMenuItem(product.id, updated);
      setProducts(prev => prev.map(p => p.id === product.id ? saved : p));
      showToast?.(`${product.name} stock set to ${newStock === 0 ? 'Out of Stock' : 'In Stock'}`);
    } catch (error) {
      showToast?.(error.message || `${product.name} stock could not be updated.`, 'error');
    }
  };

  const handleArchiveProduct = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to remove "${productName}" from the store menu?`)) return;
    try {
      await archiveAdminMenuItem(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      showToast?.(`Removed ${productName} from store menu`);
    } catch (error) {
      showToast?.(error.message || `${productName} could not be archived.`, 'error');
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const productPayload = {
      ...(editingProduct?.id ? { id: editingProduct.id } : {}),
      name: formData.get('name'),
      categoryId: formData.get('categoryId'),
      price: parseFloat(formData.get('price')),
      calorieInfo: formData.get('calorieInfo') || '850 kcal',
      description: formData.get('description'),
      imageUrl: formData.get('imageUrl') || 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80',
      stockCount: parseInt(formData.get('stockCount') || '999', 10),
      isBestseller: formData.get('isBestseller') === 'on',
      isSpicy: formData.get('isSpicy') === 'on',
      hasOptions: formData.get('hasOptions') === 'on',
      isAvailable: editingProduct?.isAvailable ?? true
    };

    try {
      if (editingProduct) {
        const saved = await updateAdminMenuItem(editingProduct.id, productPayload);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? saved : p));
        showToast?.(`Updated ${productPayload.name}`);
      } else {
        const saved = await createAdminMenuItem(productPayload);
        setProducts(prev => [saved, ...prev]);
        showToast?.(`Added new product ${productPayload.name}`);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      showToast?.(error.message || `${productPayload.name} could not be saved.`, 'error');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email) return;
    try {
      const staffEntry = await createAdminStaff({ ...newStaff, isActive: true });
      setStaffList(prev => [staffEntry, ...prev]);
      setIsStaffModalOpen(false);
      setNewStaff({ name: '', email: '', role: 'staff', password: '' });
      showToast?.(`Added staff member ${staffEntry.name}`);
    } catch (error) {
      showToast?.(error.message || 'The staff account could not be created.', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(storeSettings.openingHours);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Opening hours must be a JSON object.');
      }
      const saved = await updateAdminSetting('OpeningHours', JSON.stringify(parsed));
      setStoreSettings({ openingHours: JSON.stringify(JSON.parse(saved.value), null, 2) });
      showToast?.('Opening hours saved.');
    } catch (error) {
      showToast?.(error.message || 'Opening hours could not be saved.', 'error');
    }
  };

  const exportMonthlyCSV = () => {
    if (monthlyDays.length === 0) return;
    const headers = ['Date', 'Orders', 'Gross Revenue', 'Refunds', 'Net Revenue'];
    const rows = monthlyDays.map(d => [
      d.date,
      d.orders,
      d.gross.toFixed(2),
      d.refunds.toFixed(2),
      d.net.toFixed(2)
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RFC_Monthly_Financials_${selectedMonth}.csv`);
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
              SERVER-CONFIRMED DATA
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '2px' }}>
            Store: RFC Watford • 119 Courtlands Drive, WD17 4HZ
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="search-container" style={{ width: '200px' }}>
            <Search size={16} />
            <input
              placeholder="Search global..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button onClick={() => fetchData()} className="mode-btn" style={{ background: '#FFF', border: '1px solid var(--border)' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px', overflowX: 'auto' }}>
        {[
          { id: 'kanban', label: '📋 Live Kitchen Kanban', count: activeKitchenCount },
          { id: 'menu_editor', label: '🍔 Menu & Product Management', count: products.length },
          { id: 'sales_reports', label: '📊 Sales Reports (Daily & Monthly)', count: '' },
          { id: 'orders_ledger', label: '📑 All Orders Ledger', count: '' },
          { id: 'store_settings', label: '⚙️ Store Operational Settings', count: '' },
          { id: 'staff_manager', label: '👥 Staff Management', count: staffList.length },
          { id: 'customer_manager', label: '👤 Customer Directory', count: customersList.length },
          { id: 'reviews', label: '⭐ Reviews & Complaints', count: '' },
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

      {/* TAB: KANBAN */}
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

      {/* TAB: MENU & PRODUCT MANAGEMENT */}
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
              const isOutOfStock = Number(p.stockCount ?? 999) === 0;
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
                        title={isOutOfStock ? 'Open the editor to enter an exact stock quantity' : 'Set stock to zero'}
                      >
                        {isOutOfStock ? 'Restock…' : 'Out of Stock'}
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

      {/* TAB: SALES REPORTS (DAILY & MONTHLY) */}
      {activeTab === 'sales_reports' && (
        <div style={{ background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <button onClick={() => setReportType('daily')} className="btn-submit-modal" style={{ background: reportType === 'daily' ? 'var(--red)' : '#F1F5F9', color: reportType === 'daily' ? '#FFF' : 'var(--text)', width: 'auto' }}>📅 Daily Sales Report</button>
            <button onClick={() => setReportType('monthly')} className="btn-submit-modal" style={{ background: reportType === 'monthly' ? 'var(--indigo)' : '#F1F5F9', color: reportType === 'monthly' ? '#FFF' : 'var(--text)', width: 'auto' }}>📆 Monthly Financial Report</button>
          </div>

          {reportType === 'daily' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Daily Sales Summary</h3>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontWeight: 700 }}
                />
              </div>

              <div className="admin-metrics">
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Gross Revenue</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--red)' }}>£{dailyGross.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Net Revenue (After Refunds)</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--green)' }}>£{dailyNet.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Orders</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--text)' }}>{dailySalesOrders.length}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Completed Rate</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--text)' }}>{dailyCompletedRate}%</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Refunds</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--amber)' }}>£{dailyRefunds.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Avg Order Value (AOV)</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--indigo)' }}>£{dailyAov}</div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'monthly' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Monthly Financial Report</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontWeight: 700 }}
                  />
                  <button onClick={exportMonthlyCSV} className="btn-add-item" style={{ padding: '8px 16px' }}>
                    <Download size={16} /> Export CSV
                  </button>
                </div>
              </div>

              <div className="admin-metrics" style={{ marginBottom: '20px' }}>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Gross Revenue</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--red)' }}>£{monthlyGross.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Net Revenue</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--green)' }}>£{monthlyNet.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Orders</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--text)' }}>{monthlySalesOrders.length}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Refunds Issued</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--amber)' }}>£{monthlyRefunds.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Avg Ticket Value (AOV)</span>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--indigo)' }}>£{monthlyAov}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Total Orders</th>
                    <th style={{ padding: '12px' }}>Gross Sales</th>
                    <th style={{ padding: '12px' }}>Refunds</th>
                    <th style={{ padding: '12px' }}>Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDays.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No data for selected month.</td></tr>
                  ) : (
                    monthlyDays.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{d.date}</td>
                        <td style={{ padding: '12px' }}>{d.orders}</td>
                        <td style={{ padding: '12px' }}>£{d.gross.toFixed(2)}</td>
                        <td style={{ padding: '12px', color: 'var(--amber)' }}>£{d.refunds.toFixed(2)}</td>
                        <td style={{ padding: '12px', fontWeight: 900, color: 'var(--green)' }}>£{d.net.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: ALL ORDERS & REFUNDS LEDGER */}
      {activeTab === 'orders_ledger' && (
        <div style={{ background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>All Orders Ledger</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Review orders and use server-backed status controls. Refunds require a dedicated server endpoint and are not initiated here.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="search-container" style={{ width: '200px' }}>
                <Search size={16} />
                <input placeholder="Search by order #, name, phone..." value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} className="search-input" />
              </div>
              <select value={ledgerFilter} onChange={(e) => setLedgerFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontWeight: 700 }}>
                <option value="All">All Statuses</option>
                <option value="Placed">Placed</option>
                <option value="Preparing">Preparing</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px' }}>Order # & Time</th>
                  <th style={{ padding: '12px' }}>Customer Details</th>
                  <th style={{ padding: '12px' }}>Type & Payment</th>
                  <th style={{ padding: '12px' }}>Items Summary</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Total (£)</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledgerOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--red)' }}>#{o.orderNumber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{o.orderTime || new Date(o.createdAt).toLocaleString()}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <strong>{o.customerName}</strong><br/>
                      <span style={{ color: 'var(--text2)' }}>{o.customerPhone}</span><br/>
                      {o.deliveryAddress && <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{o.deliveryAddress}</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{o.orderType}</span><br/>
                      <span style={{ fontSize: '0.75rem' }}>{o.paymentMethod || 'CARD'}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.75rem' }}>
                      {o.items?.map((item, idx) => <div key={idx}>{item.quantity}x {item.name || item.item?.name}</div>)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge status-${(o.orderStatus || 'placed').toLowerCase().replace(/\s+/g, '')}`}>
                        {o.orderStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 900 }}>
                      £{o.total?.toFixed(2)}
                      {o.orderStatus === 'Refunded' && o.refundAmount && (
                        <div style={{ color: 'var(--amber)', fontSize: '0.75rem', fontWeight: 700 }}>-£{o.refundAmount.toFixed(2)} Refunded</div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setPrintModalOrder(o)} className="mode-btn" style={{ background: '#F1F5F9', padding: '6px', borderRadius: 'var(--radius-xs)' }} title="Print Docket">
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: STORE SETTINGS & OPS */}
      {activeTab === 'store_settings' && (
        <div style={{ maxWidth: '680px', background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} /> Store Operational Controls</h3>
          
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Opening Hours JSON</label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: '4px 0 8px' }}>This is the only operational setting currently consumed by the ordering backend. Changes are applied only after the server confirms them.</p>
              <textarea
                value={storeSettings.openingHours}
                onChange={(e) => setStoreSettings({ openingHours: e.target.value })}
                className="notes-input"
                spellCheck="false"
                required
                style={{ width: '100%', minHeight: '300px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              />
            </div>

            <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}>
              <Save size={16} /> Save Opening Hours
            </button>
          </form>
        </div>
      )}

      {/* TAB: STAFF MANAGEMENT */}
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
                    <span className="card-badge badge-bestseller" style={{ background: s.role === 'manager' ? 'var(--red)' : 'var(--indigo)' }}>{s.role}</span>
                  </td>
                  <td style={{ padding: '12px' }}><span className={`status-badge ${s.isActive ? 'status-completed' : 'status-cancelled'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ padding: '12px', color: 'var(--text3)' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: CUSTOMERS DIRECTORY */}
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
                <th style={{ padding: '12px' }}>Lifetime Spend</th>
              </tr>
            </thead>
            <tbody>
              {customersList.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px', fontWeight: 800 }}>{c.name}</td>
                  <td style={{ padding: '12px' }}>{c.email}<br/><span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{c.phone}</span></td>
                  <td style={{ padding: '12px' }}>{c.address}</td>
                  <td style={{ padding: '12px', fontWeight: 700 }}>{c.orderCount || 0} orders</td>
                  <td style={{ padding: '12px', fontWeight: 900, color: 'var(--amber)' }}>£{Number(c.lifetimeSpend || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: REVIEWS & COMPLAINTS */}
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
                  <input name="stockCount" type="number" min="0" max="9999" defaultValue={editingProduct?.stockCount ?? 999} className="input-group" style={{ width: '100%', marginTop: '4px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Image URL</label>
                <input name="imageUrl" defaultValue={editingProduct?.imageUrl || ''} className="input-group" style={{ width: '100%', marginTop: '4px' }} placeholder="https://images.unsplash.com/..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--surface-alt)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" name="isBestseller" defaultChecked={editingProduct?.isBestseller} /> Bestseller Badge</label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" name="isSpicy" defaultChecked={editingProduct?.isSpicy} /> Spicy Badge</label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" name="hasOptions" defaultChecked={editingProduct?.hasOptions ?? true} /> Side & Drink Choices</label>
              </div>
              <div className="modal-footer" style={{ padding: 0, marginTop: '10px' }}>
                <button type="button" className="btn-back" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit-modal" style={{ flex: 1 }}>{editingProduct ? 'Save Product Changes' : 'Create Product'}</button>
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
                  <option value="staff">Staff (orders and kitchen)</option>
                  <option value="manager">Manager (full access)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Initial Password</label>
                <input type="password" autoComplete="new-password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} required minLength={8} className="input-group" style={{ width: '100%', marginTop: '4px' }} />
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
