import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Check, Edit3, Gift, Home, LogOut, Mail, MapPin, MessageSquare, Phone, Printer, RotateCcw, Save, Search, ShoppingBag, Sparkles, Tag, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { deleteCurrentCustomer } from '../services/api';
import { getCurrentUser, loginCustomer, logoutCustomer, registerCustomer, updateCustomerProfile } from '../services/customerAuth';

const getOrderItemName = (item) => item.name || item.item?.name || 'Menu item';
const getOrderItemUnitPrice = (item) => Number(item.price ?? item.unitPrice ?? item.item?.price ?? 0);

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'profile', label: 'Account', icon: User },
  { id: 'reviews', label: 'Reviews', icon: MessageSquare }
];

export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, showToast }) {
  const [activeTab, setActiveTab] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [authMode, setAuthMode] = useState('none');
  const [authError, setAuthError] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', address: '', postcode: '' });
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    postcode: '',
    consentAccepted: false
  });

  useEffect(() => {
    let isActive = true;

    if (isOpen) {
      getCurrentUser()
        .then((user) => {
          if (!isActive) return;
          setCurrentUser(user);
          setAuthMode(user ? 'none' : 'login');
          setProfileForm({
            name: user?.name || '',
            phone: user?.phone || '',
            email: user?.email || '',
            address: user?.address || '',
            postcode: user?.postcode || ''
          });
        })
        .catch(() => {
          if (!isActive) return;
          setCurrentUser(null);
          setAuthMode('login');
        });
    }

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  const loyaltyCount = (orders.length % 8) || Math.min(7, orders.length);
  const ordersNeeded = Math.max(1, 8 - loyaltyCount);
  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      if (authMode === 'login') {
        const result = await loginCustomer(authForm.email, authForm.password);
        setCurrentUser(result.user);
        setProfileForm({
          name: result.user.name || '',
          phone: result.user.phone || '',
          email: result.user.email || '',
          address: result.user.address || '',
          postcode: result.user.postcode || ''
        });
        setAuthMode('none');
        showToast?.(`Welcome back, ${result.user.name}.`);
      } else {
        if (!authForm.consentAccepted) {
          setAuthError('Please accept the Privacy Policy and Terms.');
          return;
        }
        const user = await registerCustomer(authForm);
        setCurrentUser(user);
        setProfileForm({
          name: user.name || '',
          phone: user.phone || '',
          email: user.email || '',
          address: user.address || '',
          postcode: user.postcode || ''
        });
        setAuthMode('none');
        showToast?.(`Account created. Welcome ${user.name}.`);
      }
    } catch (error) {
      setAuthError(error.message || 'Account request failed.');
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    try {
      const updated = await updateCustomerProfile(profileForm);
      setCurrentUser(updated);
      setIsEditingProfile(false);
      showToast?.('Profile details updated.');
    } catch (error) {
      showToast?.(error.message || 'Profile could not be updated.', 'error');
    }
  };

  const handleLogout = async () => {
    await logoutCustomer();
    setCurrentUser(null);
    setAuthMode('login');
    setIsEditingProfile(false);
    showToast?.('Logged out.', 'info');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your RFC account and anonymise retained order records?')) return;
    try {
      await deleteCurrentCustomer();
      setCurrentUser(null);
      setAuthMode('login');
      showToast?.('Account deleted and order records anonymised.', 'info');
    } catch (error) {
      showToast?.(error.message || 'Account could not be deleted.', 'error');
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div
          className="modal-card customer-dashboard-card"
          onClick={(event) => event.stopPropagation()}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 26 }}
        >
          <div className="modal-header">
            <div>
              <h3>{currentUser ? `Good evening, ${currentUser.name?.split(' ')[0] || 'friend'}` : 'Your RFC Account'}</h3>
              <p className="modal-subtitle">
                {currentUser ? 'Rainy night? Comfort food incoming.' : 'Login to reorder favourites and save delivery details.'}
              </p>
            </div>
            <button className="close-btn" type="button" onClick={onClose} aria-label="Close account">
              <X size={18} />
            </button>
          </div>

          <div className="dashboard-tabs" style={{ padding: '16px 20px 0' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} /> {tab.label}
                </button>
              );
            })}
            {currentUser ? (
              <button className="dashboard-tab" type="button" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            ) : (
              <button className="dashboard-tab" type="button" onClick={() => setAuthMode(authMode === 'none' ? 'login' : 'none')}>
                <User size={16} /> Login
              </button>
            )}
          </div>

          <div className="modal-body customer-portal-body">
            {authMode !== 'none' ? (
              <AuthPanel
                authMode={authMode}
                authForm={authForm}
                authError={authError}
                setAuthMode={setAuthMode}
                setAuthForm={setAuthForm}
                onSubmit={handleAuthSubmit}
              />
            ) : (
              <>
                {activeTab === 'home' && (
                  <div className="for-you-grid">
                    <section className="dashboard-card">
                      <h4>Because you loved the Peri-Peri</h4>
                      <div className="recommendation-rail">
                        {['Peri-Peri Wings', 'Club Max Burger', 'Boneless Banquet', 'Chilli Cheese Bites', 'Apple Pie'].map((name, index) => (
                          <article key={name} className="recommendation-card" style={{ animationDelay: `${index * 80}ms` }}>
                            <h4>{name}</h4>
                            <p className="cart-line-meta">Chef-picked for tonight</p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <aside className="dashboard-card">
                      <div className="promo-countdown">
                        <Sparkles size={20} />
                        <p>Direct order deal ends in</p>
                        <strong>02:14:33</strong>
                      </div>
                      <h4 style={{ marginTop: 16 }}>Loyalty progress</h4>
                      <div className="card-meta">
                        {Array.from({ length: 8 }).map((_, index) => (
                          <span key={index} className={index < loyaltyCount ? 'gold-text' : ''}>
                            {index < loyaltyCount ? <Check size={13} /> : index + 1}
                          </span>
                        ))}
                      </div>
                      <p className="cart-line-meta">Just {ordersNeeded} more order{ordersNeeded === 1 ? '' : 's'} until your next reward.</p>
                    </aside>

                    <section className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
                      <h4>Order again</h4>
                      {recentOrders.length === 0 ? (
                        <p className="cart-line-meta">Your repeat-order shortcuts will appear here after checkout.</p>
                      ) : (
                        <div className="order-again-rail">
                          {recentOrders.map((order, index) => (
                            <OrderAgainCard
                              key={order.id || order.orderNumber || index}
                              order={order}
                              onReorder={onReorder}
                              onPrintReceipt={onPrintReceipt}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {activeTab === 'orders' && (
                  <OrdersPanel
                    orders={orders}
                    onReorder={onReorder}
                    onPrintReceipt={onPrintReceipt}
                    onCancel={(orderToCancel) => setCancelModalOrder(orderToCancel)}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfilePanel
                    currentUser={currentUser}
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    isEditingProfile={isEditingProfile}
                    setIsEditingProfile={setIsEditingProfile}
                    onSave={handleSaveProfile}
                    onDelete={handleDeleteAccount}
                  />
                )}

                {activeTab === 'reviews' && <ReviewsManager isAdmin={false} showToast={showToast} />}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn-back" type="button" onClick={onClose}>Close</button>
          </div>
        </motion.div>

        <CancelOrderModal
          isOpen={Boolean(cancelModalOrder)}
          onClose={() => setCancelModalOrder(null)}
          order={cancelModalOrder}
          onConfirmCancel={(orderId, reason) => {
            onCancelOrder?.(orderId, reason);
            setCancelModalOrder(null);
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function AuthPanel({ authMode, authForm, authError, setAuthMode, setAuthForm, onSubmit }) {
  return (
    <form className="dashboard-card" onSubmit={onSubmit}>
      <h4>{authMode === 'login' ? 'Login to customer account' : 'Create customer account'}</h4>
      {authError && <p className="form-error">{authError}</p>}

      {authMode === 'register' && (
        <label className="input-group">
          <User size={16} />
          <input placeholder="Full name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required />
        </label>
      )}
      <label className="input-group">
        <Mail size={16} />
        <input type="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required />
      </label>
      <label className="input-group">
        <User size={16} />
        <input type="password" placeholder="Password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required />
      </label>

      {authMode === 'register' && (
        <>
          <label className="input-group">
            <Phone size={16} />
            <input placeholder="Phone" value={authForm.phone} onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })} />
          </label>
          <label className="input-group">
            <MapPin size={16} />
            <input placeholder="Street address" value={authForm.address} onChange={(event) => setAuthForm({ ...authForm, address: event.target.value })} />
          </label>
          <label className="input-group">
            <MapPin size={16} />
            <input placeholder="Postcode" value={authForm.postcode} onChange={(event) => setAuthForm({ ...authForm, postcode: event.target.value.toUpperCase() })} />
          </label>
          <label className="consent-row">
            <input type="checkbox" checked={authForm.consentAccepted} onChange={(event) => setAuthForm({ ...authForm, consentAccepted: event.target.checked })} />
            <span>I agree to the Privacy Policy and Terms.</span>
          </label>
        </>
      )}

      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
        <button className="btn-submit-modal" type="submit">{authMode === 'login' ? 'Login' : 'Create account'}</button>
        <button className="btn-back" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
          {authMode === 'login' ? 'Register' : 'Login'}
        </button>
      </div>
    </form>
  );
}

function OrderAgainCard({ order, onReorder, onPrintReceipt }) {
  return (
    <article className="order-again-card">
      <div className="order-collage">RFC</div>
      <h4>Order #{order.orderNumber || 'recent'}</h4>
      <p className="cart-line-meta">{order.items?.slice(0, 3).map(getOrderItemName).join(', ') || 'RFC favourites'}</p>
      <div className="modal-footer" style={{ padding: '12px 0 0' }}>
        <button className="btn-add-item compact" type="button" onClick={() => onReorder(order)}>
          <RotateCcw size={14} /> Reorder
        </button>
        <button className="btn-back" type="button" onClick={() => onPrintReceipt(order)}>
          <Printer size={14} />
        </button>
      </div>
    </article>
  );
}

function OrdersPanel({ orders, onReorder, onPrintReceipt, onCancel }) {
  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <ShoppingBag size={44} />
        <h3>No previous orders yet</h3>
        <p>Your order history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="live-feed">
      {orders.map((order, index) => {
        const canCancel = order.orderStatus === 'Placed' || order.orderStatus === 'Preparing';
        return (
          <article key={order.id || index} className="dashboard-card">
            <div className="receipt-header-row">
              <div>
                <h4>Order #{order.orderNumber}</h4>
                <p className="cart-line-meta">{order.orderTime || (order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : 'Today')}</p>
              </div>
              <span className={`status-badge status-${(order.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>
                {order.orderStatus || 'Completed'}
              </span>
            </div>
            {order.items?.map((item, itemIndex) => (
              <div key={`${item.id || getOrderItemName(item)}-${itemIndex}`} className="receipt-row">
                <span>{item.quantity}x {getOrderItemName(item)}</span>
                <span>GBP {(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="receipt-total-row">
              <span>Total</span>
              <span>GBP {order.total?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="receipt-actions" style={{ marginTop: 12 }}>
              {canCancel && <button className="btn-soft-danger" type="button" onClick={() => onCancel(order)}>Cancel</button>}
              <button className="btn-back" type="button" onClick={() => onPrintReceipt(order)}><Printer size={14} /> Receipt</button>
              <button className="btn-add-item compact" type="button" onClick={() => onReorder(order)}><RotateCcw size={14} /> Reorder</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProfilePanel({ currentUser, profileForm, setProfileForm, isEditingProfile, setIsEditingProfile, onSave, onDelete }) {
  if (!currentUser) {
    return <p className="empty-state">Login to save your address and reorder faster.</p>;
  }

  return (
    <section className="dashboard-card">
      <div className="receipt-header-row">
        <h4>Saved delivery profile</h4>
        <button className="btn-add-item compact" type="button" onClick={() => setIsEditingProfile(!isEditingProfile)}>
          <Edit3 size={14} /> {isEditingProfile ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!isEditingProfile ? (
        <div className="profile-detail-card">
          <p><strong>Name:</strong> {currentUser.name}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Phone:</strong> {currentUser.phone || 'Not saved'}</p>
          <p><strong>Address:</strong> {currentUser.address || 'Not saved'}</p>
          <p><strong>Postcode:</strong> {currentUser.postcode || 'Not saved'}</p>
        </div>
      ) : (
        <form onSubmit={onSave}>
          {[
            ['name', 'Full name', User],
            ['phone', 'Phone', Phone],
            ['address', 'Street address', MapPin],
            ['postcode', 'Postcode', MapPin]
          ].map(([field, label, Icon]) => (
            <label key={field} className="input-group" style={{ marginBottom: 10 }}>
              <Icon size={16} />
              <input value={profileForm[field]} placeholder={label} onChange={(event) => setProfileForm({ ...profileForm, [field]: field === 'postcode' ? event.target.value.toUpperCase() : event.target.value })} />
            </label>
          ))}
          <button className="btn-submit-modal" type="submit"><Save size={16} /> Save changes</button>
        </form>
      )}

      <div className="danger-zone">
        <h5>Account deletion</h5>
        <p>Delete your customer login and anonymise retained order records.</p>
        <button className="btn-soft-danger" type="button" onClick={onDelete}>Delete My Account</button>
      </div>
    </section>
  );
}

CustomerDashboard.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  orders: PropTypes.array,
  onReorder: PropTypes.func.isRequired,
  onPrintReceipt: PropTypes.func.isRequired,
  onCancelOrder: PropTypes.func,
  showToast: PropTypes.func
};

AuthPanel.propTypes = {
  authMode: PropTypes.oneOf(['login', 'register']).isRequired,
  authForm: PropTypes.object.isRequired,
  authError: PropTypes.string,
  setAuthMode: PropTypes.func.isRequired,
  setAuthForm: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired
};

OrderAgainCard.propTypes = {
  order: PropTypes.object.isRequired,
  onReorder: PropTypes.func.isRequired,
  onPrintReceipt: PropTypes.func.isRequired
};

OrdersPanel.propTypes = {
  orders: PropTypes.array.isRequired,
  onReorder: PropTypes.func.isRequired,
  onPrintReceipt: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

ProfilePanel.propTypes = {
  currentUser: PropTypes.object,
  profileForm: PropTypes.object.isRequired,
  setProfileForm: PropTypes.func.isRequired,
  isEditingProfile: PropTypes.bool.isRequired,
  setIsEditingProfile: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};
