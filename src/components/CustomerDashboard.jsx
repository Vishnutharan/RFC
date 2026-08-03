import React, { useState, useEffect } from 'react';
import { X, User, ShoppingBag, Gift, MapPin, Printer, RotateCcw, Check, Sparkles, Tag, Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { getCurrentUser, updateCustomerProfile, loginCustomer, registerCustomer, logoutCustomer } from '../services/customerAuth';

export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, showToast }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [cancelModalOrder, setCancelModalOrder] = useState(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', address: '', postcode: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Auth Mode State
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
    if (showToast) showToast('Profile and address saved successfully! ✨');
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');

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
        setAuthError('Please enter your Name, Email, and Password');
        return;
      }
      const user = registerCustomer(authForm);
      setCurrentUser(user);
      setAuthMode('none');
      if (showToast) showToast(`Account created! Welcome, ${user.name} 🎉`);
    }
  };

  const handleLogout = () => {
    logoutCustomer();
    const guest = getCurrentUser();
    setCurrentUser(guest);
    if (showToast) showToast('Logged out of customer account.');
  };

  const loyaltyCount = (orders.length % 8) || 7;
  const ordersNeeded = 8 - loyaltyCount;
  const loyaltyPercent = Math.min(100, Math.round((loyaltyCount / 8) * 100));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '820px', borderRadius: 'var(--radius-lg)' }} onClick={(e) => e.stopPropagation()}>
        
        {/* User Hero Header */}
        <div style={{
          background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 100%)',
          padding: '24px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--red), var(--amber))',
              color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '1.4rem', boxShadow: 'var(--shadow-red)'
            }}>
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)' }}>
                  {currentUser?.name || 'Customer Account'}
                </h3>
                <span className="card-badge badge-bestseller" style={{ fontSize: '0.65rem' }}>⭐ VIP Member</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginTop: '2px' }}>
                📍 {currentUser?.address || '37 Berry Avenue'}, {currentUser?.postcode || 'WD24 6RU'} • {currentUser?.phone || '+44 7123 456789'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setAuthMode(authMode === 'none' ? 'login' : 'none')}
              className="btn-add-item"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <User size={15} /> {authMode !== 'none' ? '← Back to Account' : 'Switch Account / Login'}
            </button>
            <button className="close-btn" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px',
          background: '#FFF', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          {[
            { id: 'orders', label: 'My Orders', icon: ShoppingBag, count: orders.length },
            { id: 'profile', label: 'My Info & Address', icon: Edit3, count: '' },
            { id: 'loyalty', label: 'Loyalty Rewards', icon: Gift, count: `${loyaltyCount}/8` },
            { id: 'vouchers', label: 'My Vouchers', icon: Tag, count: '3' },
            { id: 'reviews', label: 'Reviews & Feedback', icon: MessageSquare, count: '' },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setAuthMode('none'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 14px',
                  borderBottom: isActive ? '3px solid var(--red)' : '3px solid transparent',
                  fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--red)' : 'var(--text2)',
                  fontSize: '0.86rem', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{t.label}</span>
                {t.count && <span className="cat-badge" style={{ background: isActive ? 'var(--red-light)' : 'var(--surface-alt)', color: isActive ? 'var(--red)' : 'var(--text2)' }}>{t.count}</span>}
              </button>
            );
          })}
        </div>

        {/* AUTH FORM MODAL VIEW */}
        {authMode !== 'none' ? (
          <div className="modal-body" style={{ padding: '30px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 900, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="var(--red)" />
              {authMode === 'login' ? 'Sign In to Your Account' : 'Create New Customer Account'}
            </h4>

            {authError && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--red-light)', border: '1px solid #FEE2E2', color: 'var(--red)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px' }}>
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Full Name</label>
                  <div className="input-group"><User size={16} /><input placeholder="Full Name (e.g. Vishnu Karun)" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required /></div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Email Address</label>
                <div className="input-group"><Mail size={16} /><input type="email" placeholder="email@example.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required /></div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Password</label>
                <div className="input-group"><Lock size={16} /><input type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required /></div>
              </div>

              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Phone Number</label>
                    <div className="input-group"><Phone size={16} /><input placeholder="+44 7123 456789" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Street Address</label>
                    <div className="input-group"><MapPin size={16} /><input placeholder="37 Berry Avenue" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} /></div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Postcode</label>
                    <div className="input-group"><MapPin size={16} /><input placeholder="WD24 6RU" value={authForm.postcode} onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn-submit-modal" style={{ flex: 1 }}>
                  {authMode === 'login' ? 'Sign In Now' : 'Create Account'}
                </button>
                <button type="button" className="mode-btn" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ border: '1px solid var(--border)' }}>
                  {authMode === 'login' ? 'Need an account? Register' : 'Existing customer? Sign In'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* MAIN ACCOUNT TABS VIEW */
          <div className="modal-body" style={{ minHeight: '360px', maxHeight: '60vh', overflowY: 'auto', padding: '24px' }}>
            
            {/* 1. MY ORDERS TAB */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)' }}>
                    <ShoppingBag size={54} strokeWidth={1} style={{ marginBottom: '12px', color: 'var(--red)' }} />
                    <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>No Orders Placed Yet</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '4px' }}>Order your favourite RFC crispy chicken to earn loyalty points!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {orders.map((ord, i) => {
                      const canCancel = ord.orderStatus === 'Placed' || ord.orderStatus === 'Preparing';
                      return (
                        <div key={ord.id || i} style={{
                          background: '#FFF', borderRadius: 'var(--radius)', padding: '20px',
                          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                          display: 'flex', flexDirection: 'column', gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 900, fontSize: '1.05rem', fontFamily: 'var(--font-head)' }}>Order #{ord.orderNumber}</span>
                                <span className={`status-badge status-${(ord.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>
                                  {ord.orderStatus || 'Completed'}
                                </span>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px', fontWeight: 600 }}>
                                🕒 {ord.orderTime || (ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Today')}
                              </p>
                            </div>
                            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.25rem', color: 'var(--red)' }}>
                              £{ord.total?.toFixed(2) || '0.00'}
                            </span>
                          </div>

                          {/* Food Items Breakdown */}
                          <div style={{ background: 'var(--surface-alt)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            {ord.items && ord.items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text2)', padding: '2px 0' }}>
                                <span>{it.quantity}x {it.name}</span>
                                <span style={{ fontWeight: 700 }}>£{(it.price * it.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            {ord.cancellationReason && (
                              <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={14} /> Cancelled: {ord.cancellationReason}
                              </p>
                            )}
                          </div>

                          {/* Order Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
                            {canCancel && (
                              <button
                                onClick={() => setCancelModalOrder(ord)}
                                style={{
                                  padding: '7px 14px', borderRadius: 'var(--radius-full)',
                                  background: '#FEF2F2', color: 'var(--red)', border: '1px solid #FEE2E2',
                                  fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer'
                                }}
                              >
                                Cancel Order
                              </button>
                            )}

                            <button
                              onClick={() => onPrintReceipt(ord)}
                              className="mode-btn"
                              style={{ border: '1px solid var(--border)', padding: '6px 14px', fontSize: '0.8rem' }}
                            >
                              <Printer size={14} /> Print Receipt
                            </button>

                            <button
                              onClick={() => onReorder(ord)}
                              className="btn-add-item"
                              style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                            >
                              <RotateCcw size={14} /> Reorder
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. MY INFO & ADDRESS TAB */}
            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900 }}>
                      ⚙️ Customer Contact Details &amp; Address
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Used to automatically pre-fill your checkout details.</p>
                  </div>
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="btn-add-item"
                    style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                  >
                    <Edit3 size={15} /> {isEditingProfile ? 'Cancel' : 'Edit Info'}
                  </button>
                </div>

                {!isEditingProfile ? (
                  <div style={{ background: '#FFF', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Full Name</span>
                      <p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.name}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Email Address</span>
                      <p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.email}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone Number</span>
                      <p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.phone}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Street Address</span>
                      <p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.address}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Postcode</span>
                      <p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.postcode}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Full Name</label>
                      <div className="input-group"><User size={16} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Phone Number</label>
                      <div className="input-group"><Phone size={16} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Street Address</label>
                      <div className="input-group"><MapPin size={16} /><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} required /></div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Postcode</label>
                      <div className="input-group"><MapPin size={16} /><input value={profileForm.postcode} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value.toUpperCase() })} required /></div>
                    </div>

                    <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}>
                      <Save size={16} /> Save Changes
                    </button>
                  </form>
                )}

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LogOut size={16} /> Log Out of Account
                  </button>
                </div>
              </div>
            )}

            {/* 3. LOYALTY REWARDS TAB */}
            {activeTab === 'loyalty' && (
              <div>
                <div style={{
                  background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)',
                  borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid #FDE2E2',
                  textAlign: 'center', marginBottom: '20px'
                }}>
                  <Sparkles size={32} color="var(--amber)" style={{ marginBottom: '8px' }} />
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900 }}>RFC Watford Loyalty Club</h4>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text2)', marginTop: '4px' }}>
                    Collect 8 order stamps to receive a <strong>10% OFF Voucher</strong> on your next feast!
                  </p>

                  {/* Progress Bar */}
                  <div style={{ margin: '20px 0 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px' }}>
                      <span>Progress</span>
                      <span>{loyaltyPercent}% Complete ({loyaltyCount}/8 Stamps)</span>
                    </div>
                    <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${loyaltyPercent}%`, background: 'linear-gradient(90deg, var(--red), var(--amber))', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  {/* 8 Stamp Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '20px 0' }}>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const isFilled = i < loyaltyCount;
                      return (
                        <div key={i} style={{
                          aspectRatio: '1', borderRadius: '16px',
                          background: isFilled ? 'var(--red)' : '#FFF',
                          border: isFilled ? 'none' : '2px dashed var(--border)',
                          color: isFilled ? '#FFF' : 'var(--text3)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: '0.95rem', boxShadow: isFilled ? 'var(--shadow-red)' : 'none'
                        }}>
                          {isFilled ? <Check size={24} /> : <span>#{i + 1}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--red)' }}>
                    🎉 Just {ordersNeeded} more order{ordersNeeded === 1 ? '' : 's'} until your free 10% reward!
                  </p>
                </div>
              </div>
            )}

            {/* 4. VOUCHERS TAB */}
            {activeTab === 'vouchers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { code: 'FIRST10', title: '10% OFF First Order', desc: 'Valid for new customers. No minimum spend required.' },
                  { code: 'OVER25', title: '10% OFF Orders over £25', desc: 'Valid on delivery & collection orders over £25.' },
                  { code: 'RFC10', title: '10% OFF Special Deal', desc: 'Exclusive offer for direct website orders.' },
                ].map((v, i) => (
                  <div key={i} className="voucher-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="voucher-code">{v.code}</span>
                      <h5 style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '2px' }}>{v.title}</h5>
                      <p className="voucher-desc">{v.desc}</p>
                    </div>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(v.code).catch(() => {});
                        if (showToast) showToast(`Voucher ${v.code} copied!`);
                      }}
                    >
                      Copy Code
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 5. REVIEWS & COMPLAINTS TAB */}
            {activeTab === 'reviews' && (
              <ReviewsManager isAdmin={false} showToast={showToast} />
            )}

          </div>
        )}

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="mode-btn" onClick={onClose} style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border)' }}>
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
