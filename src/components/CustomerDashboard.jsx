import React, { useState, useEffect } from 'react';
import { X, User, ShoppingBag, Gift, MapPin, Printer, RotateCcw, Check, Sparkles, Tag, Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare } from 'lucide-react';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { getCurrentUser, updateCustomerProfile, loginCustomer, registerCustomer, logoutCustomer } from '../services/customerAuth';

export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, showToast }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'profile', 'loyalty', 'vouchers', 'reviews'
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [cancelModalOrder, setCancelModalOrder] = useState(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: '', phone: '', email: '', address: '', postcode: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Auth Mode (if logged out or switching account)
  const [authMode, setAuthMode] = useState('none'); // 'none', 'login', 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '', address: '', postcode: '' });
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const u = getCurrentUser();
      setCurrentUser(u);
      setProfileForm({
        name: u.name || '',
        phone: u.phone || '',
        email: u.email || '',
        address: u.address || '',
        postcode: u.postcode || ''
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const updated = updateCustomerProfile(profileForm);
    setCurrentUser(updated);
    setIsEditingProfile(false);
    if (showToast) showToast('Profile details updated successfully! ✨');
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (authMode === 'login') {
      const res = loginCustomer(authForm.email, authForm.password);
      if (res.success) {
        setCurrentUser(res.user);
        setAuthMode('none');
        if (showToast) showToast(`Welcome back, ${res.user.name}! 🎉`);
      } else {
        setAuthError(res.message);
      }
    } else if (authMode === 'register') {
      if (!authForm.name || !authForm.email || !authForm.password) {
        setAuthError('Please fill in required fields (Name, Email, Password)');
        return;
      }
      const user = registerCustomer(authForm);
      setCurrentUser(user);
      setAuthMode('none');
      if (showToast) showToast(`Account created! Welcome ${user.name} 🎉`);
    }
  };

  const loyaltyCount = (orders.length % 8) || 7;
  const ordersNeeded = 8 - loyaltyCount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '740px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--red), var(--amber))',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.1rem'
            }}>
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 800 }}>
                {currentUser?.name || 'Customer Profile'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                📍 {currentUser?.address || '37 Berry Avenue'}, {currentUser?.postcode || 'WD24 6RU'} · {currentUser?.email}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px',
          background: 'var(--bg)', gap: '6px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'orders', label: 'Order History', icon: ShoppingBag, count: orders.length },
              { id: 'profile', label: 'My Info & Address', icon: Edit3, count: '' },
              { id: 'loyalty', label: 'Loyalty Rewards', icon: Gift, count: `${loyaltyCount}/8` },
              { id: 'vouchers', label: 'My Vouchers', icon: Tag, count: '3' },
              { id: 'reviews', label: 'Reviews & Complaints', icon: MessageSquare, count: '' },
            ].map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setAuthMode('none'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '12px 10px', borderBottom: isActive ? '3px solid var(--red)' : '3px solid transparent',
                    fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--red)' : 'var(--text2)',
                    fontSize: '0.82rem', background: 'none', cursor: 'pointer'
                  }}
                >
                  <Icon size={15} />
                  <span>{t.label}</span>
                  {t.count && <span className="cat-badge" style={{ background: isActive ? 'var(--red-light)' : 'var(--border)' }}>{t.count}</span>}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setAuthMode(authMode === 'none' ? 'login' : 'none')}
            style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--red)', cursor: 'pointer', padding: '6px' }}
          >
            {authMode !== 'none' ? '← Back' : 'Switch Account / Login'}
          </button>
        </div>

        {/* AUTH MODAL VIEW (If Login/Register Clicked) */}
        {authMode !== 'none' ? (
          <div className="modal-body" style={{ padding: '24px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 800, marginBottom: '14px' }}>
              {authMode === 'login' ? '🔑 Login to Customer Account' : '📝 Create New Customer Account'}
            </h4>

            {authError && <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '12px' }}>{authError}</p>}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {authMode === 'register' && (
                <div className="input-group"><User size={16} /><input placeholder="Full Name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></div>
              )}
              <div className="input-group"><Mail size={16} /><input type="email" placeholder="Email Address" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div>
              <div className="input-group"><Lock size={16} /><input type="password" placeholder="Password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></div>

              {authMode === 'register' && (
                <>
                  <div className="input-group"><Phone size={16} /><input placeholder="Phone Number" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div>
                  <div className="input-group"><MapPin size={16} /><input placeholder="Street Address" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} /></div>
                  <div className="input-group"><MapPin size={16} /><input placeholder="Postcode (e.g. WD24 6RU)" value={authForm.postcode} onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value })} /></div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-submit-modal">
                  {authMode === 'login' ? 'Login' : 'Register Account'}
                </button>
                <button type="button" className="btn-back" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="modal-body" style={{ minHeight: '340px', maxHeight: '62vh', overflowY: 'auto' }}>
            
            {/* PROFILE / EDIT INFORMATION TAB */}
            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.1rem', fontWeight: 800 }}>
                    ⚙️ Personal Details &amp; Default Delivery Address
                  </h4>
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="btn-add-item"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Edit3 size={14} /> {isEditingProfile ? 'Cancel Editing' : 'Edit Information'}
                  </button>
                </div>

                {!isEditingProfile ? (
                  <div style={{ background: 'var(--bg)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '0.9rem' }}><strong>Full Name:</strong> {currentUser?.name}</p>
                    <p style={{ fontSize: '0.9rem' }}><strong>Email Address:</strong> {currentUser?.email}</p>
                    <p style={{ fontSize: '0.9rem' }}><strong>Phone Number:</strong> {currentUser?.phone}</p>
                    <p style={{ fontSize: '0.9rem' }}><strong>Default Address:</strong> {currentUser?.address}</p>
                    <p style={{ fontSize: '0.9rem' }}><strong>Postcode:</strong> {currentUser?.postcode}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Full Name</label>
                      <div className="input-group"><User size={16} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Phone Number</label>
                      <div className="input-group"><Phone size={16} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Street Address</label>
                      <div className="input-group"><MapPin size={16} /><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Postcode</label>
                      <div className="input-group"><MapPin size={16} /><input value={profileForm.postcode} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value.toUpperCase() })} /></div>
                    </div>

                    <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}>
                      <Save size={16} /> Save Changes
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
                    <ShoppingBag size={42} strokeWidth={1} style={{ marginBottom: '10px' }} />
                    <h4>No previous orders yet</h4>
                    <p style={{ fontSize: '0.82rem' }}>Order your favourite chicken today to unlock rewards!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {orders.map((ord, i) => {
                      const canCancel = ord.orderStatus === 'Placed' || ord.orderStatus === 'Preparing';
                      return (
                        <div key={ord.id || i} style={{
                          background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                          padding: '16px', border: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '0.98rem' }}>Order #{ord.orderNumber}</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text3)', marginLeft: '10px', fontWeight: 600 }}>
                                🕒 {ord.orderTime || (ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Today')}
                              </span>
                            </div>
                            <span className={`status-badge status-${(ord.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>
                              {ord.orderStatus || 'Completed'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--text2)', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            {ord.items && ord.items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span>{it.quantity}x {it.name}</span>
                                <span style={{ fontWeight: 700 }}>£{(it.price * it.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            {ord.cancellationReason && (
                              <p style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: '6px', fontWeight: 700 }}>
                                ⚠️ Cancelled: {ord.cancellationReason}
                              </p>
                            )}
                          </div>

                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px'
                          }}>
                            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.1rem', color: 'var(--red)' }}>
                              Total: £{ord.total?.toFixed(2) || '0.00'}
                            </span>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {canCancel && (
                                <button
                                  onClick={() => setCancelModalOrder(ord)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 'var(--radius-full)',
                                    background: '#FEF2F2', color: 'var(--red)', border: '1px solid #FEE2E2',
                                    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  Cancel Order
                                </button>
                              )}

                              <button
                                onClick={() => onPrintReceipt(ord)}
                                className="btn-qty"
                                title="Print Receipt"
                                style={{ width: 'auto', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', gap: 4 }}
                              >
                                <Printer size={14} /> Receipt
                              </button>

                              <button
                                onClick={() => onReorder(ord)}
                                className="btn-add-item"
                                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                              >
                                <RotateCcw size={14} /> Reorder
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LOYALTY TAB */}
            {activeTab === 'loyalty' && (
              <div>
                <div style={{
                  background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)',
                  borderRadius: 'var(--radius)', padding: '20px', border: '1px solid #FDE2E2',
                  marginBottom: '20px', textAlign: 'center'
                }}>
                  <Sparkles size={28} color="var(--amber)" style={{ marginBottom: '6px' }} />
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900 }}>RFC Loyalty Stamps</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '4px' }}>
                    Complete 8 orders to earn a <strong>10% OFF Voucher</strong> on your next order!
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', margin: '20px 0' }}>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const isFilled = i < loyaltyCount;
                      return (
                        <div key={i} style={{
                          aspectRatio: '1', borderRadius: '12px',
                          background: isFilled ? 'var(--red)' : '#fff',
                          border: isFilled ? 'none' : '2px dashed var(--border)',
                          color: isFilled ? '#fff' : 'var(--text3)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.85rem', boxShadow: isFilled ? 'var(--shadow-red)' : 'none'
                        }}>
                          {isFilled ? <Check size={20} /> : <span>#{i + 1}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--red)' }}>
                    🎉 Just {ordersNeeded} more order{ordersNeeded === 1 ? '' : 's'} until your free reward!
                  </p>
                </div>
              </div>
            )}

            {/* VOUCHERS TAB */}
            {activeTab === 'vouchers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { code: 'FIRST10', title: '10% OFF First Order', desc: 'Valid for new customers. No minimum spend.' },
                  { code: 'OVER25', title: '10% OFF Orders over £25', desc: 'Valid on delivery & collection orders over £25.' },
                  { code: 'RFC10', title: '10% OFF Special Deal', desc: 'Exclusive offer for direct website orders.' },
                ].map((v, i) => (
                  <div key={i} className="voucher-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="voucher-code">{v.code}</span>
                      <h5 style={{ fontWeight: 800, fontSize: '0.9rem', marginTop: '2px' }}>{v.title}</h5>
                      <p className="voucher-desc">{v.desc}</p>
                    </div>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(v.code).catch(() => {});
                        showToast(`Voucher ${v.code} copied!`);
                      }}
                    >
                      Copy Code
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* REVIEWS & COMPLAINTS TAB */}
            {activeTab === 'reviews' && (
              <ReviewsManager isAdmin={false} showToast={showToast} />
            )}

          </div>
        )}

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn-back" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Close Customer Portal
          </button>
        </div>
      </div>

      {/* CANCEL ORDER MODAL */}
      <CancelOrderModal
        isOpen={!!cancelModalOrder}
        onClose={() => setCancelModalOrder(null)}
        order={cancelModalOrder}
        onConfirmCancel={(orderId, reason) => {
          if (onCancelOrder) onCancelOrder(orderId, reason);
        }}
      />
    </div>
  );
}
