import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, TrendingUp, DollarSign, Clock, RefreshCw, Download, CheckCircle, Truck, AlertTriangle, ChevronRight, Search, Printer, Calendar, Star, MessageSquare, Flame } from 'lucide-react';
import { getAdminOrders, updateOrderStatus } from '../services/api';
import PrintReceiptModal from './PrintReceiptModal';
import ReviewsManager from './ReviewsManager';

export default function AdminDashboard({ showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'daily_sales', 'reviews'
  const [printModalOrder, setPrintModalOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders();
      setOrders(data || []);
    } catch (e) {
      console.warn('Failed to load admin orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId || o.orderNumber === orderId) ? { ...o, orderStatus: newStatus } : o));
      if (showToast) showToast(`Order #${orderId} moved to ${newStatus}`);
    } catch (e) {
      if (showToast) showToast('Failed to update status', 'error');
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
            <h2>RFC Store Management POS</h2>
            <span className="card-badge badge-spicy" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFF', animation: 'pulse 1.2s infinite' }} /> LIVE
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
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button onClick={fetchOrders} className="mode-btn" style={{ background: '#FFF', border: '1px solid var(--border)' }}>
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
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Sales Revenue</span>
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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>
        {[
          { id: 'kanban', label: '📋 Live Kitchen Kanban Board', count: activeKitchenCount },
          { id: 'daily_sales', label: '📅 Daily Sales Inspector', count: '' },
          { id: 'reviews', label: '⭐ Customer Reviews & Complaints', count: '' },
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
              fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
            }}
          >
            <span>{t.label}</span>
            {t.count !== '' && <span className="cat-badge" style={{ background: activeTab === t.id ? 'rgba(255,255,255,0.3)' : 'var(--surface-alt)' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* 1. LIVE KITCHEN KANBAN BOARD */}
      {activeTab === 'kanban' && (
        <div className="kanban-board">
          {kanbanColumns.map(col => {
            const colOrders = filteredOrders.filter(o => o.orderStatus === col.id || (col.id === 'Completed' && o.orderStatus === 'Delivered'));
            return (
              <div key={col.id} className="kanban-col">
                <div className="kanban-header" style={{ color: col.color }}>
                  <span>{col.title}</span>
                  <span className="cat-badge" style={{ background: col.bg, color: col.color }}>{colOrders.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {colOrders.length === 0 ? (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
                      No orders in this status
                    </div>
                  ) : (
                    colOrders.map((ord, idx) => (
                      <div key={ord.id || idx} className="kanban-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 900, fontFamily: 'var(--font-head)', fontSize: '0.98rem' }}>#{ord.orderNumber}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 600 }}>
                            {ord.orderTime ? ord.orderTime.split(',')[1] : 'Just now'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.83rem', color: 'var(--text2)' }}>
                          <p style={{ fontWeight: 800, color: 'var(--text)' }}>👤 {ord.customerName}</p>
                          <p>📞 {ord.customerPhone}</p>
                          <p style={{ marginTop: '4px' }}>
                            {ord.orderType === 'delivery' ? `🚚 ${ord.deliveryAddress}` : '🏪 Store Pickup'}
                          </p>
                        </div>

                        {/* Items */}
                        <div style={{ background: 'var(--surface-alt)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.78rem' }}>
                          {ord.items && ord.items.map((it, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{it.quantity}x {it.name}</span>
                              <span style={{ fontWeight: 700 }}>£{(it.price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.05rem', color: 'var(--red)' }}>
                            £{ord.total?.toFixed(2)}
                          </span>

                          <button
                            onClick={() => setPrintModalOrder(ord)}
                            className="mode-btn"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid var(--border)' }}
                            title="Print Kitchen Docket"
                          >
                            <Printer size={13} /> Print
                          </button>
                        </div>

                        {/* Status Advance Buttons */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {col.id === 'Placed' && (
                            <button onClick={() => handleStatusChange(ord.id || ord.orderNumber, 'Preparing')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.78rem' }}>
                              Send to Kitchen ➔
                            </button>
                          )}
                          {col.id === 'Preparing' && (
                            <button onClick={() => handleStatusChange(ord.id || ord.orderNumber, 'Out for Delivery')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.78rem', background: 'var(--indigo)' }}>
                              Dispatch Driver ➔
                            </button>
                          )}
                          {col.id === 'Out for Delivery' && (
                            <button onClick={() => handleStatusChange(ord.id || ord.orderNumber, 'Completed')} className="btn-submit-modal" style={{ width: '100%', padding: '6px', fontSize: '0.78rem', background: 'var(--green)' }}>
                              Mark Delivered ✔
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

      {/* 2. DAILY SALES INSPECTOR */}
      {activeTab === 'daily_sales' && (
        <div style={{ background: '#FFF', borderRadius: 'var(--radius)', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900 }}>Daily Financial Sales Inspector</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Inspect daily revenue, orders count, and payment method breakdowns.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontWeight: 700 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)' }}>Selected Day Revenue</span>
              <p style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.5rem', color: 'var(--red)', marginTop: '4px' }}>£{dailyRevenue.toFixed(2)}</p>
            </div>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)' }}>Selected Day Orders</span>
              <p style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.5rem', marginTop: '4px' }}>{dailySalesOrders.length}</p>
            </div>
          </div>

          {/* Orders Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
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
                {dailySalesOrders.map((o, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '12px', fontWeight: 800 }}>#{o.orderNumber}</td>
                    <td style={{ padding: '12px', color: 'var(--text2)' }}>{o.orderTime || o.createdAt}</td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{o.customerName}</td>
                    <td style={{ padding: '12px' }}>{o.orderType === 'delivery' ? '🚚 Delivery' : '🏪 Collection'}</td>
                    <td style={{ padding: '12px', textTransform: 'uppercase', fontWeight: 700 }}>{o.paymentMethod}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge status-${(o.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>
                        {o.orderStatus || 'Completed'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 900, color: 'var(--red)' }}>£{o.total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. REVIEWS & COMPLAINTS TAB */}
      {activeTab === 'reviews' && (
        <ReviewsManager isAdmin={true} showToast={showToast} />
      )}

      {/* thermal receipt modal */}
      <PrintReceiptModal
        isOpen={!!printModalOrder}
        onClose={() => setPrintModalOrder(null)}
        order={printModalOrder}
      />
    </div>
  );
}
