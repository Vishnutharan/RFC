import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Calendar, Download, Eye, Printer, RefreshCw, Search, ShoppingBag, Timer, TrendingUp, Truck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAdminOrders, updateOrderStatus } from '../services/api';
import PrintReceiptModal from './PrintReceiptModal';
import ReviewsManager from './ReviewsManager';

const STATUS_OPTIONS = ['Placed', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled'];
const STATUS_CLASS = {
  Placed: 'status-placed',
  Preparing: 'status-preparing',
  'Out for Delivery': 'status-outfordelivery',
  Completed: 'status-completed',
  Cancelled: 'status-cancelled'
};

const getOrderItemName = (item) => item.name || item.item?.name || 'Menu item';
const getOrderItemUnitPrice = (item) => Number(item.price ?? item.unitPrice ?? item.item?.price ?? 0);

export default function AdminDashboard({ showToast, adminUser, onExit }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders();
      setOrders(data || []);
    } catch (error) {
      setOrders([]);
      showToast?.(error.message || 'Could not load staff orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, orderStatus: newStatus } : order));
      setSelectedOrderForDetail((prev) => prev?.id === orderId ? { ...prev, orderStatus: newStatus } : prev);
      showToast?.(`Order updated to ${newStatus}.`);
    } catch (error) {
      showToast?.(error.message || 'Order status could not be updated.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order Number', 'Order Time', 'Type', 'Customer Name', 'Phone', 'Address', 'Total GBP', 'Status'];
    const rows = orders.map((order) => [
      order.orderNumber,
      `"${order.orderTime || (order.createdAt ? new Date(order.createdAt).toLocaleString() : '')}"`,
      order.orderType,
      `"${order.customerName || ''}"`,
      `"${order.customerPhone || ''}"`,
      `"${order.deliveryAddress || ''}"`,
      order.total?.toFixed(2) || '0.00',
      order.orderStatus
    ]);

    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(','), ...rows.map((row) => row.join(','))].join('\n')}`;
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `RFC_Orders_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Orders exported to CSV.');
  };

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesFilter = filter === 'All' || order.orderStatus === filter;
    const matchesSearch = !query ||
      order.orderNumber?.toLowerCase().includes(query) ||
      order.customerName?.toLowerCase().includes(query) ||
      order.customerPhone?.toLowerCase().includes(query) ||
      order.deliveryAddress?.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [filter, orders, searchQuery]);

  const dailySalesData = useMemo(() => {
    const dayOrders = orders.filter((order) => {
      const orderDate = order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      return orderDate === selectedDate;
    });
    const dayRevenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const deliveryCount = dayOrders.filter((order) => order.orderType === 'delivery').length;
    const collectionCount = dayOrders.filter((order) => order.orderType === 'collection').length;
    const topItemsMap = {};
    dayOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const name = getOrderItemName(item);
        topItemsMap[name] = (topItemsMap[name] || 0) + Number(item.quantity || 1);
      });
    });

    return {
      dayOrders,
      dayRevenue,
      deliveryCount,
      collectionCount,
      topItems: Object.entries(topItemsMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [orders, selectedDate]);

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const activeCount = orders.filter((order) => order.orderStatus !== 'Completed' && order.orderStatus !== 'Cancelled').length;
  const avgValue = orders.length ? totalRevenue / orders.length : 0;
  const todayOrders = orders.filter((order) => (order.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return (
    <main className="admin-container">
      <motion.header className="admin-header" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2>Store Manager</h2>
          <p className="modal-subtitle">Live order operations for {adminUser?.email || 'RFC staff'}.</p>
        </div>
        <div className="admin-actions">
          <button className="btn-back" type="button" onClick={onExit}>Storefront</button>
          <button className="btn-back" type="button" onClick={handleExportCSV}><Download size={16} /> Export</button>
          <button className="btn-add-item compact" type="button" onClick={loadOrders}><RefreshCw size={16} /> Refresh</button>
        </div>
      </motion.header>

      <div className="dashboard-tabs">
        {[
          { id: 'orders', label: 'Live Orders', count: orders.length },
          { id: 'daily-sales', label: 'Daily Sales', count: `GBP ${dailySalesData.dayRevenue.toFixed(0)}` },
          { id: 'reviews', label: 'Reviews', count: '' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} {tab.count && <span>({tab.count})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <>
          <section className="admin-metrics">
            <KpiCard icon={ShoppingBag} label="Orders Today" value={todayOrders.toString()} />
            <KpiCard icon={TrendingUp} label="Revenue" value={`GBP ${totalRevenue.toFixed(0)}`} />
            <KpiCard icon={Timer} label="Avg Prep Time" value="18m" />
            <KpiCard icon={Truck} label="Active Deliveries" value={activeCount.toString()} />
          </section>

          <div className="admin-toolbar">
            <div className="filter-tabs">
              {['All', ...STATUS_OPTIONS].map((status) => (
                <button
                  key={status}
                  className={`filter-tab ${filter === status ? 'active' : ''}`}
                  type="button"
                  onClick={() => setFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <label className="search-container">
              <Search size={16} />
              <input
                className="search-input"
                placeholder="Search order, customer, phone..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <div className="empty-state">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">No matching orders found.</div>
          ) : (
            <OrdersTable
              orders={filteredOrders}
              onStatusChange={handleStatusChange}
              onView={setSelectedOrderForDetail}
              onPrint={setSelectedOrderForPrint}
            />
          )}

          <section className="dashboard-card" style={{ marginTop: 20 }}>
            <h4>Live activity feed</h4>
            <div className="live-feed">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id || order.orderNumber} className="feed-item">
                  <strong>#{order.orderNumber}</strong> {order.customerName || 'Customer'} - {order.orderStatus}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'daily-sales' && (
        <section>
          <div className="admin-header">
            <div>
              <h2>Daily Sales</h2>
              <p className="modal-subtitle">Inspect transactions and item performance by date.</p>
            </div>
            <label className="input-group">
              <Calendar size={16} />
              <input className="date-input" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          </div>

          <div className="admin-metrics">
            <KpiCard icon={TrendingUp} label="Revenue" value={`GBP ${dailySalesData.dayRevenue.toFixed(2)}`} />
            <KpiCard icon={ShoppingBag} label="Orders" value={dailySalesData.dayOrders.length.toString()} />
            <KpiCard icon={Truck} label="Delivery" value={dailySalesData.deliveryCount.toString()} />
            <KpiCard icon={ShoppingBag} label="Collection" value={dailySalesData.collectionCount.toString()} />
          </div>

          {dailySalesData.topItems.length > 0 && (
            <div className="dashboard-card" style={{ marginBottom: 20 }}>
              <h4>Top sellers</h4>
              <div className="card-meta">
                {dailySalesData.topItems.map(([name, qty], index) => (
                  <span key={name}>{index + 1}. {name} - {qty} sold</span>
                ))}
              </div>
            </div>
          )}

          <OrdersTable
            orders={dailySalesData.dayOrders}
            onStatusChange={handleStatusChange}
            onView={setSelectedOrderForDetail}
            onPrint={setSelectedOrderForPrint}
          />
        </section>
      )}

      {activeTab === 'reviews' && <ReviewsManager isAdmin showToast={showToast} />}

      {selectedOrderForDetail && (
        <div className="modal-overlay" onClick={() => setSelectedOrderForDetail(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Order #{selectedOrderForDetail.orderNumber}</h3>
              <button className="close-btn" type="button" onClick={() => setSelectedOrderForDetail(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="profile-detail-card">
                <p><strong>Customer:</strong> {selectedOrderForDetail.customerName}</p>
                <p><strong>Phone:</strong> {selectedOrderForDetail.customerPhone}</p>
                <p><strong>Email:</strong> {selectedOrderForDetail.customerEmail}</p>
                <p><strong>Address:</strong> {selectedOrderForDetail.deliveryAddress}</p>
                <p><strong>Payment:</strong> {selectedOrderForDetail.paymentMethod}</p>
              </div>
              <div className="receipt-section">
                {selectedOrderForDetail.items?.map((item, index) => (
                  <div key={`${item.id || getOrderItemName(item)}-${index}`} className="receipt-row">
                    <span>{item.quantity}x {getOrderItemName(item)}</span>
                    <span>GBP {(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="receipt-total-row">
                  <span>Total</span>
                  <span>GBP {selectedOrderForDetail.total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-submit-modal"
                type="button"
                onClick={() => {
                  setSelectedOrderForPrint(selectedOrderForDetail);
                  setSelectedOrderForDetail(null);
                }}
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintReceiptModal
        isOpen={Boolean(selectedOrderForPrint)}
        onClose={() => setSelectedOrderForPrint(null)}
        order={selectedOrderForPrint}
      />
    </main>
  );
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <svg className="sparkline" viewBox="0 0 120 30" aria-hidden="true">
        <polyline points="2,22 22,18 42,20 62,10 82,13 102,5 118,8" />
      </svg>
      <Icon className="gold-text" size={20} />
    </article>
  );
}

function OrdersTable({ orders, onStatusChange, onView, onPrint }) {
  if (orders.length === 0) return <div className="empty-state">No orders for this view.</div>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Time</th>
            <th>Type</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => (
            <tr key={order.id || index}>
              <td><strong>#{order.orderNumber}</strong></td>
              <td>{order.orderTime || (order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : 'Just now')}</td>
              <td><span className="status-badge status-placed">{order.orderType}</span></td>
              <td>
                <strong>{order.customerName || 'Customer'}</strong>
                <p className="cart-line-meta">{order.customerPhone}</p>
              </td>
              <td>{order.items?.length || 0}</td>
              <td><strong className="gold-text">GBP {order.total?.toFixed(2) || '0.00'}</strong></td>
              <td><span className={`status-badge ${STATUS_CLASS[order.orderStatus] || 'status-placed'}`}>{order.orderStatus}</span></td>
              <td>
                <div className="receipt-actions">
                  <select value={order.orderStatus} onChange={(event) => onStatusChange(order.id, event.target.value)} aria-label="Update status">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button className="btn-back" type="button" onClick={() => onView(order)} aria-label="View order"><Eye size={15} /></button>
                  <button className="btn-back" type="button" onClick={() => onPrint(order)} aria-label="Print order"><Printer size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

AdminDashboard.propTypes = {
  showToast: PropTypes.func,
  adminUser: PropTypes.object,
  onExit: PropTypes.func.isRequired
};

KpiCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired
};

OrdersTable.propTypes = {
  orders: PropTypes.array.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired,
  onPrint: PropTypes.func.isRequired
};
