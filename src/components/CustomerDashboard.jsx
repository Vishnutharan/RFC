import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, User, ShoppingBag, Gift, MapPin, Printer, RotateCcw, Check, Sparkles, 
  Tag, Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle, 
  Camera, Upload, Image, Star, ShieldCheck, Heart, Award, ArrowLeft
} from 'lucide-react';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { getCurrentUser, updateCustomerProfile, loginCustomer, registerCustomer, logoutCustomer } from '../services/customerAuth';

const AVATAR_PRESETS = [
  { id: 'drumstick', label: '🍗 Crispy Drumstick', color: '#EF4444' },
  { id: 'burger', label: '🍔 Gourmet Burger', color: '#F59E0B' },
  { id: 'crown', label: '👑 VIP Crown', color: '#8B5CF6' },
  { id: 'flame', label: '⚡ Spicy Flame', color: '#DC2626' },
  { id: 'rocket', label: '🚀 Fast Delivery', color: '#2563EB' },
  { id: 'pepper', label: '🌶️ Hot Pepper', color: '#10B981' },
  { id: 'gentleman', label: '🎩 Chef Master', color: '#1F2937' },
  { id: 'star', label: '🌟 Gold Star', color: '#D97706' }
];

export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, showToast }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [currentUser, setCurrentUser] = useState({ name: 'Vishnu Karun', email: 'vishnu@example.com', phone: '+44 7700 900077', address: '37 Berry Avenue', postcode: 'WD24 6RU', avatarUrl: '', avatarPreset: 'crown' });
  const [cancelModalOrder, setCancelModalOrder] = useState(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', address: '', postcode: '', avatarUrl: '', avatarPreset: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Auth Mode State
  const [authMode, setAuthMode] = useState('none'); // 'none', 'login', 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '', address: '', postcode: '' });
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedUser = localStorage.getItem('rfc_customer_profile');
      let u = savedUser ? JSON.parse(savedUser) : {
        name: 'Vishnu Karun',
        email: 'vishnu@example.com',
        phone: '+44 7700 900077',
        address: '37 Berry Avenue',
        postcode: 'WD24 6RU',
        avatarUrl: '',
        avatarPreset: 'crown'
      };

      setCurrentUser(u);
      setProfileForm({
        name: u.name || '',
        phone: u.phone || '',
        email: u.email || '',
        address: u.address || '',
        postcode: u.postcode || '',
        avatarUrl: u.avatarUrl || '',
        avatarPreset: u.avatarPreset || 'crown'
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Profile Picture File Upload (Image to DataURL)
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (showToast) showToast('Image file size must be less than 5MB ⚠️');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const updatedForm = { ...profileForm, avatarUrl: dataUrl, avatarPreset: '' };
      setProfileForm(updatedForm);
      
      const updatedUser = { ...currentUser, ...updatedForm };
      setCurrentUser(updatedUser);
      localStorage.setItem('rfc_customer_profile', JSON.stringify(updatedUser));
      if (showToast) showToast('Profile picture updated successfully! 📸');
    };
    reader.readAsDataURL(file);
  };

  // Handle Avatar Preset Selection
  const selectPreset = (presetId) => {
    const updatedForm = { ...profileForm, avatarUrl: '', avatarPreset: presetId };
    setProfileForm(updatedForm);
    
    const updatedUser = { ...currentUser, ...updatedForm };
    setCurrentUser(updatedUser);
    localStorage.setItem('rfc_customer_profile', JSON.stringify(updatedUser));
    if (showToast) showToast('Avatar updated! ✨');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateCustomerProfile(profileForm);
    } catch (err) {}
    const updated = { ...currentUser, ...profileForm };
    setCurrentUser(updated);
    localStorage.setItem('rfc_customer_profile', JSON.stringify(updated));
    setIsEditingProfile(false);
    if (showToast) showToast('Profile details saved! ✨');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'login') {
      try {
        const res = await loginCustomer(authForm.email, authForm.password);
        if (res.success && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('rfc_customer_profile', JSON.stringify(res.user));
          setAuthMode('none');
          if (showToast) showToast(`Welcome back, ${res.user.name}! 🎉`);
          return;
        }
      } catch (err) {}

      const mockUser = {
        name: authForm.email.split('@')[0] || 'Customer',
        email: authForm.email,
        phone: '+44 7700 900077',
        address: '15 Watford High St',
        postcode: 'WD17 1HP',
        avatarPreset: 'crown'
      };
      setCurrentUser(mockUser);
      localStorage.setItem('rfc_customer_profile', JSON.stringify(mockUser));
      setAuthMode('none');
      if (showToast) showToast(`Welcome back! 🎉`);

    } else if (authMode === 'register') {
      if (!authForm.name || !authForm.email || !authForm.password) {
        setAuthError('Please enter your Name, Email, and Password');
        return;
      }
      const newUser = {
        name: authForm.name,
        email: authForm.email,
        phone: authForm.phone || '+44 7700 900077',
        address: authForm.address || '37 Berry Avenue',
        postcode: authForm.postcode || 'WD24 6RU',
        avatarPreset: 'star'
      };
      try {
        await registerCustomer(authForm);
      } catch (err) {}
      setCurrentUser(newUser);
      localStorage.setItem('rfc_customer_profile', JSON.stringify(newUser));
      setAuthMode('none');
      if (showToast) showToast(`Account created! Welcome, ${newUser.name} 🎉`);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutCustomer();
    } catch (err) {}
    localStorage.removeItem('rfc_customer_profile');
    const guestUser = { name: 'Guest Customer', email: '', phone: '', address: '', postcode: '', avatarPreset: 'drumstick' };
    setCurrentUser(guestUser);
    if (showToast) showToast('Logged out of customer account.');
  };

  const loyaltyCount = (orders.length % 8) || 7;
  const loyaltyPercent = Math.min(100, Math.round((loyaltyCount / 8) * 100));

  // Render User Avatar Icon / Image
  const renderUserAvatar = (size = 64) => {
    if (currentUser?.avatarUrl) {
      return (
        <img 
          src={currentUser.avatarUrl} 
          alt="Profile Avatar" 
          style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }} 
        />
      );
    }

    const preset = AVATAR_PRESETS.find(p => p.id === currentUser?.avatarPreset) || AVATAR_PRESETS[2];
    const initial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

    return (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: `linear-gradient(135deg, ${preset.color}, var(--amber))`,
        color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: `${size * 0.45}px`, boxShadow: 'var(--shadow-red)',
        border: '3px solid #FFF', position: 'relative'
      }}>
        {initial}
      </div>
    );
  };

  const TABS = [
    { id: 'orders', label: 'My Orders', icon: ShoppingBag, count: orders.length },
    { id: 'profile', label: 'Profile Settings', icon: Edit3, count: '' },
    { id: 'loyalty', label: 'Loyalty Rewards', icon: Gift, count: `${loyaltyCount}/8` },
    { id: 'vouchers', label: 'My Vouchers', icon: Tag, count: '3' },
    { id: 'reviews', label: 'Reviews & Feedback', icon: MessageSquare, count: '' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%' }}>
      {/* Header Bar */}
      <div style={{ background: '#FFF', borderBottom: '1px solid var(--border)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text)', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
            <ArrowLeft size={20} /> Back to Menu
          </button>
          {authMode === 'none' && (
            <button onClick={() => setAuthMode('login')} className="btn-add-item" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Switch Account
            </button>
          )}
        </div>
      </div>

      <main className="customer-dashboard-container" style={{ maxWidth: '1320px', margin: '24px auto', padding: '0 20px' }}>
        
        {authMode !== 'none' ? (
          <div style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', padding: '40px', maxWidth: '500px', margin: '40px auto', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Lock size={24} color="var(--red)" />
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h4>

            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--red-light)', border: '1px solid #FEE2E2', color: 'var(--red)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '20px' }}>
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Full Name</label>
                  <div className="input-group"><User size={18} /><input placeholder="Full Name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required style={{ padding: '12px' }} /></div>
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Email Address</label>
                <div className="input-group"><Mail size={18} /><input type="email" placeholder="email@example.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required style={{ padding: '12px' }} /></div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Password</label>
                <div className="input-group"><Lock size={18} /><input type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required style={{ padding: '12px' }} /></div>
              </div>
              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Phone Number</label>
                    <div className="input-group"><Phone size={18} /><input placeholder="+44 7123 456789" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} style={{ padding: '12px' }} /></div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Street Address</label>
                    <div className="input-group"><MapPin size={18} /><input placeholder="37 Berry Avenue" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} style={{ padding: '12px' }} /></div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Postcode</label>
                    <div className="input-group"><MapPin size={18} /><input placeholder="WD24 6RU" value={authForm.postcode} onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value })} style={{ padding: '12px' }} /></div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <button type="submit" className="btn-submit-modal" style={{ padding: '14px', fontSize: '1.05rem' }}>{authMode === 'login' ? 'Sign In' : 'Register'}</button>
                <button type="button" className="mode-btn" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ border: '1px solid var(--border)', padding: '12px' }}>{authMode === 'login' ? 'Need an account? Register' : 'Already have one? Sign In'}</button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            <style>{`
              @media (min-width: 900px) {
                .portal-grid { display: grid; grid-template-columns: 300px 1fr; gap: 32px; align-items: start; }
              }
            `}</style>
            
            <div className="portal-grid">
              {/* Left Sidebar */}
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Profile Card */}
                <div style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <div style={{ padding: '4px', background: 'linear-gradient(135deg, var(--red), var(--amber))', borderRadius: '50%' }}>
                        {renderUserAvatar(96)}
                      </div>
                      <div style={{ position: 'absolute', bottom: 6, right: 6, width: 20, height: 20, background: 'var(--green)', borderRadius: '50%', border: '3px solid #FFF', title: 'Online' }}></div>
                    </div>
                    
                    <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)' }}>
                      {currentUser?.name || 'Customer'}
                    </h3>
                    
                    {currentUser?.name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--amber)', color: '#FFF', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 800, marginTop: '8px' }}>
                        <Star size={12} fill="#FFF" /> {loyaltyCount >= 8 ? 'GOLD VIP' : loyaltyCount >= 4 ? 'SILVER VIP' : 'BRONZE VIP'}
                      </div>
                    )}
                    
                    <p style={{ fontSize: '0.9rem', color: 'var(--text2)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <MapPin size={14} /> {currentUser?.address || 'Update address'}
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Orders</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{orders.length}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Stamps</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{loyaltyCount}/8</div>
                    </div>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  {TABS.map(t => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '16px 20px',
                          background: isActive ? 'var(--red-light)' : '#FFF',
                          border: 'none', borderLeft: isActive ? '4px solid var(--red)' : '4px solid transparent',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', transition: 'all 0.2s',
                          color: isActive ? 'var(--red)' : 'var(--text)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: isActive ? 800 : 600, fontSize: '0.95rem' }}>
                          <Icon size={18} /> {t.label}
                        </div>
                        {t.count && <span style={{ background: isActive ? '#FFF' : 'var(--surface)', color: isActive ? 'var(--red)' : 'var(--text2)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 800 }}>{t.count}</span>}
                      </button>
                    );
                  })}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '16px 20px',
                      background: '#FFF', border: 'none', borderLeft: '4px solid transparent',
                      cursor: 'pointer', color: 'var(--red)', fontWeight: 700, fontSize: '0.95rem'
                    }}
                  >
                    <LogOut size={18} /> Log Out
                  </button>
                </div>
              </aside>

              {/* Right Content Panel */}
              <div style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', padding: '32px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', minHeight: '600px' }}>
                
                {activeTab === 'orders' && (
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>My Orders</h2>
                    
                    {orders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)' }}>
                        <ShoppingBag size={64} strokeWidth={1} style={{ marginBottom: '16px', color: 'var(--red)' }} />
                        <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>No Orders Placed Yet</h4>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text2)', marginTop: '8px' }}>Order your favourite RFC crispy chicken to earn loyalty points!</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {orders.map((ord, i) => (
                          <div key={ord.id || i} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--font-head)' }}>Order #{ord.orderNumber}</span>
                                  <span className={`status-badge status-${(ord.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>{ord.orderStatus || 'Completed'}</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text3)', fontWeight: 600 }}>🕒 {ord.orderTime || (ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Today')}</p>
                                
                                <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text)' }}>
                                  <strong>Items:</strong> {ord.items ? ord.items.map(item => `${item.quantity}x ${item.name}`).join(', ') : 'Details unavailable'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.5rem', color: 'var(--red)' }}>£{ord.total?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                              <button onClick={() => onPrintReceipt && onPrintReceipt(ord)} className="mode-btn" style={{ border: '1px solid var(--border)', padding: '8px 16px', fontSize: '0.85rem' }}><Printer size={16} /> Print Receipt</button>
                              
                              {/* Show Cancel if not completed/cancelled */}
                              {!['completed', 'cancelled', 'delivered'].includes((ord.orderStatus || '').toLowerCase()) && (
                                <button onClick={() => setCancelModalOrder(ord)} className="mode-btn" style={{ border: '1px solid var(--red)', color: 'var(--red)', padding: '8px 16px', fontSize: '0.85rem', background: '#FFF' }}><X size={16} /> Cancel</button>
                              )}
                              
                              <button onClick={() => onReorder && onReorder(ord)} className="btn-add-item" style={{ padding: '8px 20px', fontSize: '0.9rem' }}><RotateCcw size={16} /> Reorder</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>
                      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900 }}>Profile Settings</h2>
                      <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="btn-add-item" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                        <Edit3 size={16} /> {isEditingProfile ? 'Cancel Editing' : 'Edit Profile'}
                      </button>
                    </div>

                    {!isEditingProfile ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Full Name</span>
                          <p style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>{currentUser?.name || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Email Address</span>
                          <p style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>{currentUser?.email || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone Number</span>
                          <p style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>{currentUser?.phone || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Street Address</span>
                          <p style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>{currentUser?.address || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Postcode</span>
                          <p style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '4px' }}>{currentUser?.postcode || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <label style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '16px', display: 'block' }}>Profile Avatar</label>
                          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', cursor: 'pointer', width: 96, height: 96 }} onClick={() => fileInputRef.current?.click()}>
                              {profileForm.avatarUrl ? (
                                <img src={profileForm.avatarUrl} alt="Preview" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }} />
                              ) : profileForm.avatarPreset ? (
                                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, var(--red), var(--amber))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }}>
                                  {AVATAR_PRESETS.find(p => p.id === profileForm.avatarPreset)?.label.split(' ')[0] || '👑'}
                                </div>
                              ) : (
                                <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }}>
                                  {profileForm.name ? profileForm.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--red)', borderRadius: '50%', padding: '8px', color: '#FFF', boxShadow: 'var(--shadow-sm)' }}>
                                <Camera size={16} />
                              </div>
                            </div>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                            
                            <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
                              <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Or choose a preset:</p>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {AVATAR_PRESETS.map(preset => (
                                  <button 
                                    key={preset.id} 
                                    type="button" 
                                    onClick={() => selectPreset(preset.id)} 
                                    title={preset.label}
                                    style={{ 
                                      width: 48, height: 48, borderRadius: '50%', fontSize: '20px', 
                                      background: profileForm.avatarPreset === preset.id ? 'var(--red-light)' : '#FFF', 
                                      border: profileForm.avatarPreset === preset.id ? '2px solid var(--red)' : '1px solid var(--border)', 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                      cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' 
                                    }}
                                  >
                                    {preset.label.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', display: 'block' }}>Full Name</label>
                            <div className="input-group"><User size={18} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required style={{ padding: '12px' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', display: 'block' }}>Email Address</label>
                            <div className="input-group"><Mail size={18} /><input value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required style={{ padding: '12px' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', display: 'block' }}>Phone Number</label>
                            <div className="input-group"><Phone size={18} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required style={{ padding: '12px' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', display: 'block' }}>Street Address</label>
                            <div className="input-group"><MapPin size={18} /><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} required style={{ padding: '12px' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', display: 'block' }}>Postcode</label>
                            <div className="input-group"><MapPin size={18} /><input value={profileForm.postcode} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value.toUpperCase() })} required style={{ padding: '12px' }} /></div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="submit" className="btn-submit-modal" style={{ padding: '12px 32px', fontSize: '1rem' }}><Save size={18} /> Save Changes</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {activeTab === 'loyalty' && (
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>Loyalty Rewards</h2>
                    
                    <div style={{ background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)', borderRadius: 'var(--radius-xl)', padding: '40px', border: '1px solid #FDE2E2', textAlign: 'center', marginBottom: '32px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: loyaltyCount >= 8 ? 'var(--amber)' : loyaltyCount >= 4 ? 'var(--indigo)' : 'var(--red)', color: '#FFF', padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.9rem', fontWeight: 900, marginBottom: '16px', boxShadow: 'var(--shadow-sm)' }}>
                        <Sparkles size={16} />
                        {loyaltyCount >= 8 ? '👑 GOLD VIP MASTER' : loyaltyCount >= 4 ? '🥈 SILVER CONNOISSEUR' : '🥉 BRONZE FOODIE'}
                      </div>

                      <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '2rem', fontWeight: 900, margin: 0, color: 'var(--text)' }}>RFC Watford Loyalty Club</h3>
                      <p style={{ fontSize: '1rem', color: 'var(--text2)', marginTop: '8px' }}>Earn 1 stamp per order. Collect 8 stamps for 15% OFF your next feast!</p>

                      <div style={{ maxWidth: '600px', margin: '32px auto 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, marginBottom: '8px' }}>
                          <span>Stamp Progress</span>
                          <span>{loyaltyPercent}% ({loyaltyCount}/8 Stamps)</span>
                        </div>
                        <div style={{ height: '12px', borderRadius: 'var(--radius-full)', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${loyaltyPercent}%`, background: 'linear-gradient(90deg, var(--red), var(--amber))', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      {/* 8-Stamp Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '16px', maxWidth: '800px', margin: '40px auto' }}>
                        {Array.from({ length: 8 }).map((_, i) => {
                          const isFilled = i < loyaltyCount;
                          return (
                            <div 
                              key={i} 
                              style={{ 
                                aspectRatio: '1', 
                                borderRadius: '20px', 
                                background: isFilled ? 'linear-gradient(135deg, var(--red), #DC2626)' : '#FFF', 
                                border: isFilled ? 'none' : '3px dashed var(--border)', 
                                color: isFilled ? '#FFF' : 'var(--text3)', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 900, 
                                fontSize: '1.2rem',
                                boxShadow: isFilled ? '0 8px 16px rgba(220, 38, 38, 0.3)' : 'var(--shadow-sm)',
                                transition: 'all 0.3s ease',
                                transform: isFilled ? 'scale(1.05)' : 'scale(1)'
                              }}
                            >
                              {isFilled ? (
                                <>
                                  <Check size={28} />
                                  <span style={{ fontSize: '0.7rem', marginTop: 4 }}>STAMP</span>
                                </>
                              ) : (
                                <span>{i + 1}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Claim Reward Action */}
                      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                        {loyaltyCount >= 8 ? (
                          <button
                            type="button"
                            className="btn-submit-modal"
                            onClick={() => {
                              confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
                              if (navigator.clipboard?.writeText) navigator.clipboard.writeText('LOYAL15');
                              if (showToast) showToast('🎉 Reward Claimed! Voucher LOYAL15 (15% OFF) copied to clipboard!', 'success');
                            }}
                            style={{
                              width: '100%', padding: '18px', fontSize: '1.2rem', fontWeight: 900,
                              background: 'linear-gradient(135deg, var(--amber), #D97706)', color: '#FFF',
                              border: 'none', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                              boxShadow: '0 10px 25px rgba(217, 119, 6, 0.4)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                            }}
                          >
                            <Award size={24} /> Claim 15% OFF Voucher
                          </button>
                        ) : (
                          <div style={{ background: '#FFF', padding: '16px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--border)', fontSize: '0.95rem', color: 'var(--text2)', fontWeight: 700 }}>
                            🔒 Place {8 - loyaltyCount} more {8 - loyaltyCount === 1 ? 'order' : 'orders'} to unlock!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loyalty Perks Roadmap */}
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, margin: '0 0 20px 0', color: 'var(--text)' }}>
                        🏆 Membership Perks
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#FFF', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '24px' }}>🥉</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800 }}>Bronze Foodie (1-3 Stamps)</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Earn 1 stamp on every order over £10</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: loyaltyCount >= 1 ? 'var(--green)' : 'var(--text3)', background: loyaltyCount >= 1 ? 'var(--green-light)' : 'var(--surface)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
                            {loyaltyCount >= 1 ? '✓ Active' : 'Locked'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#FFF', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '24px' }}>🥈</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800 }}>Silver Connoisseur (4 Stamps)</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Unlock Free Side or Drink voucher (FREESIDE)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (loyaltyCount < 4) return;
                              if (navigator.clipboard?.writeText) navigator.clipboard.writeText('FREESIDE');
                              if (showToast) showToast('Voucher FREESIDE copied to clipboard!', 'success');
                            }}
                            style={{
                              background: loyaltyCount >= 4 ? 'var(--green)' : 'var(--surface)',
                              color: loyaltyCount >= 4 ? '#FFF' : 'var(--text3)',
                              border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-full)',
                              fontWeight: 800, fontSize: '0.85rem', cursor: loyaltyCount >= 4 ? 'pointer' : 'default',
                              boxShadow: loyaltyCount >= 4 ? '0 4px 10px rgba(16, 185, 129, 0.3)' : 'none'
                            }}
                          >
                            {loyaltyCount >= 4 ? '🎁 Copy Code' : 'Locked'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#FFF', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '24px' }}>🥇</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800 }}>Gold VIP Master (8 Stamps)</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>Unlock 15% OFF entire order voucher (LOYAL15)</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: loyaltyCount >= 8 ? 'var(--amber)' : 'var(--text3)', background: loyaltyCount >= 8 ? '#FEF3C7' : 'var(--surface)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
                            {loyaltyCount >= 8 ? '👑 Unlocked' : 'Locked'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'vouchers' && (
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>My Vouchers & Promos</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {[
                        { code: 'FIRST10', title: '10% OFF First Order', desc: 'Welcome bonus for new customers.' },
                        { code: 'OVER25', title: '10% OFF Orders over £25', desc: 'Valid on delivery & collection.' },
                        { code: 'RFC10', title: '10% OFF Special Deal', desc: 'Exclusive app & website offer.' },
                      ].map((v, i) => (
                        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '6px 12px', borderRadius: 'var(--radius)', fontWeight: 900, fontSize: '0.9rem', letterSpacing: '1px' }}>{v.code}</span>
                            <h3 style={{ fontWeight: 900, fontSize: '1.2rem', marginTop: '16px', fontFamily: 'var(--font-head)' }}>{v.title}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text2)', marginTop: '8px' }}>{v.desc}</p>
                          </div>
                          <button 
                            className="btn-add-item" 
                            onClick={() => { navigator.clipboard.writeText(v.code); if (showToast) showToast(`Voucher ${v.code} copied to clipboard!`); }} 
                            style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          >
                            <Tag size={16} /> Copy Code
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '16px' }}>Reviews & Feedback</h2>
                    <ReviewsManager isAdmin={false} showToast={showToast} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

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
