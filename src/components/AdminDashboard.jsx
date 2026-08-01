import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ShoppingBag, Clock, RefreshCw, Printer, Search, Download, Eye, Calendar, Star, AlertTriangle } from 'lucide-react';
import { getAdminOrders, updateOrderStatus } from '../services/api';
import PrintReceiptModal from './PrintReceiptModal';
import ReviewsManager from './ReviewsManager';

const STATUS_OPTIONS = ['Placed', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled'];
const STATUS_CLASS = {
  Placed: 'status-placed', Preparing: 'status-preparing',
  'Out for Delivery': 'status-outfordelivery', Completed: 'status-completed',
  Cancelled: 'status-preparing'
};

const getOrderItemName = (item) => item.name || item.item?.name || 'Menu item';
const getOrderItemUnitPrice = (item) => Number(item.price ?? item.unitPrice ?? item.item?.price ?? 0);

export default function AdminDashboard({ showToast, adminUser, onExit }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'daily-sales', 'reviews'
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Daily Sales Date Picker (Default today: YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Modals
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders();
      setOrders(data || []);
    } catch (error) {
      setOrders([]);
      if (showToast) showToast(error.message || 'Could not load staff orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
      if (selectedOrderForDetail && selectedOrderForDetail.id === orderId) {
        setSelectedOrderForDetail(prev => ({ ...prev, orderStatus: newStatus }));
      }
      showToast(`Order updated to ${newStatus}`);
    } catch (error) {
      showToast(error.message || 'Order status could not be updated.', 'error');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order Number', 'Order Time', 'Type', 'Customer Name', 'Phone', 'Address', 'Total (£)', 'Status'];
    const rows = orders.map(o => [
      o.orderNumber,
      `"${o.orderTime || (o.createdAt ? new Date(o.createdAt).toLocaleString() : '')}"`,
      o.orderType,
      `"${o.customerName || ''}"`,
      `"${o.customerPhone || ''}"`,
      `"${o.deliveryAddress || ''}"`,
      o.total?.toFixed(2) || '0.00',
      o.orderStatus
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RFC_Orders_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Orders exported to CSV!');
  };

  // Filter & Search
  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'All' || o.orderStatus === filter;
    const matchesSearch = !searchQuery ||
      o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.deliveryAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Daily Sales Calculations for selectedDate
  const dailySalesData = useMemo(() => {
    const dayOrders = orders.filter(o => {
      const orderDate = o.createdAt ? o.createdAt.slice(0, 10) : todayStr;
      return orderDate === selectedDate;
    });

    const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const deliveryOrders = dayOrders.filter(o => o.orderType === 'delivery');
    const collectionOrders = dayOrders.filter(o => o.orderType === 'collection');
    const cardRevenue = dayOrders.filter(o => (o.paymentMethod || 'card').includes('card')).reduce((s, o) => s + (o.total || 0), 0);
    const cashRevenue = dayOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + (o.total || 0), 0);

    // Item popularity calculation
    const itemMap = {};
    dayOrders.forEach(o => {
      if (o.items) {
        o.items.forEach(it => {
          const name = getOrderItemName(it);
          itemMap[name] = (itemMap[name] || 0) + (it.quantity || 1);
        });
      }
    });

    const topItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      dayOrders,
      dayRevenue,
      deliveryCount: deliveryOrders.length,
      collectionCount: collectionOrders.length,
      cardRevenue,
      cashRevenue,
      topItems
    };
  }, [orders, selectedDate, todayStr]);

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const activeCount = orders.filter(o => o.orderStatus !== 'Completed' && o.orderStatus !== 'Cancelled').length;
  const avgValue = orders.length ? totalRevenue / orders.length : 0;

  return (
    <div className="admin-container">
      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900 }}>RFC Store Manager Panel</h2>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Live order tracking, daily sales inspection &amp; customer complaints</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCSV} className="btn-back" style={{ gap: '6px', fontSize: '0.85rem' }}>
            <Download size={16} /> Export CSV
          </button>
          <button onClick={loadOrders} className="btn-add-item" style={{ gap: '6px' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        {[
          { id: 'orders', label: 'Live Orders', count: orders.length },
          { id: 'daily-sales', label: 'Daily Sales Inspector', count: `£${dailySalesData.dayRevenue.toFixed(0)}` },
          { id: 'reviews', label: 'Reviews & Complaints', count: '' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-full)', fontWeight: 800, fontSize: '0.88rem',
              background: activeTab === t.id ? 'var(--red)' : 'var(--bg)',
              color: activeTab === t.id ? '#fff' : 'var(--text2)',
              boxShadow: activeTab === t.id ? 'var(--shadow-red)' : 'none', cursor: 'pointer'
            }}
          >
            {t.label} {t.count && <span style={{ opacity: 0.85, marginLeft: '6px' }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE ORDERS */}
      {activeTab === 'orders' && (
        <>
          {/* Top Metrics Cards */}
          <div className="admin-metrics">
            <div className="metric-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={22} style={{ color: 'var(--green)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Total Store Revenue</p>
                  <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900 }}>£{totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={22} style={{ color: 'var(--red)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Total Orders Placed</p>
                  <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900 }}>{orders.length}</p>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={22} style={{ color: 'var(--amber)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Active Kitchen Orders</p>
                  <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900, color: activeCount > 0 ? 'var(--red)' : 'var(--text)' }}>
                    {activeCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={22} style={{ color: '#4338CA' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Avg Order Value</p>
                  <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900 }}>£{avgValue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['All', ...STATUS_OPTIONS].map(s => (
                <button
                  key={s}
                  className={`cat-tab ${filter === s ? 'active' : ''}`}
                  onClick={() => setFilter(s)}
                >
                  {s} {s !== 'All' && `(${orders.filter(o => o.orderStatus === s).length})`}
                </button>
              ))}
            </div>

            <div className="search-container" style={{ width: '280px' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search order #, customer, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Orders Table */}
          {loading ? (
            <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <ShoppingBag size={40} strokeWidth={1} style={{ marginBottom: '10px' }} />
              <h4>No matching orders found</h4>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Exact Order Time</th>
                    <th>Type</th>
                    <th>Customer Details</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions &amp; Print</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o, i) => (
                    <tr key={o.id || i}>
                      <td style={{ fontWeight: 800 }}>#{o.orderNumber}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 600 }}>
                        {o.orderTime || (o.createdAt ? new Date(o.createdAt).toLocaleString('en-GB') : 'Just now')}
                      </td>
                      <td>
                        <span className={`status-badge ${o.orderType === 'delivery' ? 'status-placed' : 'status-preparing'}`}>
                          {o.orderType === 'delivery' ? 'Delivery' : 'Collection'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{o.customerName || 'Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{o.customerPhone}</div>
                      </td>
                      <td>{o.items?.length || 0} items</td>
                      <td style={{ fontFamily: 'var(--font-head)', fontWeight: 900, color: 'var(--red)' }}>
                        £{o.total?.toFixed(2) || '0.00'}
                      </td>
                      <td>
                        <span className={`status-badge ${STATUS_CLASS[o.orderStatus] || ''}`}>
                          {o.orderStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <select
                            value={o.orderStatus}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            style={{
                              padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)',
                              fontSize: '0.8rem', fontWeight: 700, background: '#fff', cursor: 'pointer'
                            }}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>

                          <button className="btn-qty" onClick={() => setSelectedOrderForDetail(o)} title="View Details" style={{ width: '32px', height: '32px' }}>
                            <Eye size={14} />
                          </button>

                          <button className="btn-qty" onClick={() => setSelectedOrderForPrint(o)} title="Print Kitchen Receipt" style={{ width: '32px', height: '32px', color: 'var(--red)' }}>
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: DAILY SALES INSPECTOR */}
      {activeTab === 'daily-sales' && (
        <div>
          {/* Date Selector Header */}
          <div style={{
            background: 'var(--white)', padding: '20px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', marginBottom: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px'
          }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="var(--red)" /> Select Specific Date to Inspect Sales
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginTop: '2px' }}>View all itemized transactions, revenue, and order breakdowns for a specific day</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.88rem' }}>Choose Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', fontWeight: 800, fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          {/* Selected Day Summary Cards */}
          <div className="admin-metrics">
            <div className="metric-card">
              <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Earnings on {selectedDate}</p>
              <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--green)' }}>
                £{dailySalesData.dayRevenue.toFixed(2)}
              </p>
            </div>

            <div className="metric-card">
              <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Orders Completed on {selectedDate}</p>
              <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900 }}>
                {dailySalesData.dayOrders.length}
              </p>
            </div>

            <div className="metric-card">
              <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Delivery vs Collection</p>
              <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '6px' }}>
                {dailySalesData.deliveryCount} Delivery · {dailySalesData.collectionCount} Collection
              </p>
            </div>

            <div className="metric-card">
              <p style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>Card vs Cash Breakdown</p>
              <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '6px' }}>
                Card £{dailySalesData.cardRevenue.toFixed(2)} · Cash £{dailySalesData.cashRevenue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Top Selling Items for that Day */}
          {dailySalesData.topItems.length > 0 && (
            <div style={{ background: 'var(--white)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <h4 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1rem', marginBottom: '12px' }}>Top Selling Items on {selectedDate}:</h4>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {dailySalesData.topItems.map(([name, qty], idx) => (
                  <div key={idx} style={{ background: 'var(--bg)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 700 }}>
                    {idx + 1}. {name} — <span style={{ color: 'var(--red)' }}>{qty} sold</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Day Orders Table */}
          <h4 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '12px' }}>
            Detailed Transactions for {selectedDate} ({dailySalesData.dayOrders.length}):
          </h4>

          {dailySalesData.dayOrders.length === 0 ? (
            <p style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              No orders recorded for {selectedDate}.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Exact Time</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Items Purchased</th>
                    <th>Total (£)</th>
                    <th>Status</th>
                    <th>Print</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySalesData.dayOrders.map((o, idx) => (
                    <tr key={o.id || idx}>
                      <td style={{ fontWeight: 800 }}>#{o.orderNumber}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 600 }}>
                        {o.orderTime || (o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}
                      </td>
                      <td><span className="status-badge status-placed">{o.orderType}</span></td>
                      <td>{o.customerName} ({o.customerPhone})</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {o.items && o.items.map((it) => `${it.quantity}x ${getOrderItemName(it)}`).join(', ')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-head)', fontWeight: 900, color: 'var(--red)' }}>£{o.total?.toFixed(2)}</td>
                      <td><span className={`status-badge ${STATUS_CLASS[o.orderStatus] || ''}`}>{o.orderStatus}</span></td>
                      <td>
                        <button className="btn-qty" onClick={() => setSelectedOrderForPrint(o)} title="Print Receipt" style={{ width: '30px', height: '30px' }}>
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVIEWS & COMPLAINTS */}
      {activeTab === 'reviews' && (
        <ReviewsManager isAdmin={true} showToast={showToast} />
      )}

      {/* DETAIL MODAL */}
      {selectedOrderForDetail && (
        <div className="modal-overlay" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Order Details #{selectedOrderForDetail.orderNumber}</h3>
              <button className="close-btn" onClick={() => setSelectedOrderForDetail(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '14px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <p><strong>Order Timestamp:</strong> {selectedOrderForDetail.orderTime || (selectedOrderForDetail.createdAt ? new Date(selectedOrderForDetail.createdAt).toLocaleString() : 'N/A')}</p>
                <p><strong>Customer:</strong> {selectedOrderForDetail.customerName}</p>
                <p><strong>Phone:</strong> {selectedOrderForDetail.customerPhone}</p>
                <p><strong>Email:</strong> {selectedOrderForDetail.customerEmail}</p>
                <p><strong>Address:</strong> {selectedOrderForDetail.deliveryAddress}</p>
                <p><strong>Payment Method:</strong> {selectedOrderForDetail.paymentMethod}</p>
                {selectedOrderForDetail.cancellationReason && (
                  <p style={{ color: 'var(--red)', fontWeight: 800, marginTop: '4px' }}>
                    Cancellation Reason: {selectedOrderForDetail.cancellationReason}
                  </p>
                )}
              </div>

              <h4 style={{ fontWeight: 800, marginBottom: '8px' }}>Items Ordered:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedOrderForDetail.items && selectedOrderForDetail.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.quantity}x {getOrderItemName(item)}</span>
                      {item.options && item.options.length > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{item.options.join(', ')}</div>
                      )}
                    </div>
                    <span style={{ fontWeight: 800 }}>£{(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem' }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--red)' }}>£{selectedOrderForDetail.total?.toFixed(2)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-submit-modal"
                onClick={() => {
                  setSelectedOrderForPrint(selectedOrderForDetail);
                  setSelectedOrderForDetail(null);
                }}
              >
                <Printer size={16} /> Print Kitchen Docket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      <PrintReceiptModal
        isOpen={!!selectedOrderForPrint}
        onClose={() => setSelectedOrderForPrint(null)}
        order={selectedOrderForPrint}
      />
    </div>
  );
}
