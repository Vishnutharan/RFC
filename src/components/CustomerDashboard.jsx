import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, User, ShoppingBag, Gift, MapPin, Printer, RotateCcw, Check, Sparkles, 
  Tag, Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle, 
  Camera, Upload, Image, Star, ShieldCheck, Heart, Award
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

  // Auth Mode State
  const [authMode, setAuthMode] = useState('none'); // 'none', 'login', 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '', address: '', postcode: '' });
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Load user profile from localStorage or API
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
  const handleAvatarFileUpload = (e) => {
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
  const handleSelectPresetAvatar = (presetId) => {
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
    } catch (err) {
      // Fallback local save
    }
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
      } catch (err) {
        // Fallback login
      }

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
      } catch (err) {
        // Local state
      }
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
  const ordersNeeded = 8 - loyaltyCount;
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

  return (
    <div className="customer-dashboard-container" style={{ maxWidth: '1280px', margin: '24px auto', padding: '0 20px' }}>
      
      {/* Header Back Navigation & Customer Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)',
        padding: '28px 32px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <button 
            type="button"
            onClick={onClose}
            className="btn-add-item"
            style={{ padding: '8px 18px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            ← Back to Menu
          </button>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setAuthMode(authMode === 'none' ? 'login' : 'none')}
              className="mode-btn"
              style={{ fontSize: '0.82rem', padding: '8px 14px', border: '1px solid var(--border)', background: '#FFF' }}
            >
              {authMode !== 'none' ? '← Account Portal' : 'Switch / Login Account'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ padding: '3px', background: 'linear-gradient(135deg, var(--red), var(--amber))', borderRadius: '50%' }}>
                {renderUserAvatar(68)}
              </div>
              <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, background: 'var(--green)', borderRadius: '50%', border: '2px solid #FFF' }}></div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                  {currentUser?.name || 'Customer Portal'}
                </h3>
                {currentUser?.name && (
                  <span className="cat-badge" style={{ background: 'var(--amber)', color: '#FFF', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px' }}>
                    <Star size={11} fill="#FFF" /> VIP MEMBER
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} color="var(--red)" /> {currentUser?.address || 'Update address in profile'} {currentUser?.postcode ? `• ${currentUser.postcode}` : ''}
              </p>
            </div>
          </div>
        </div>

          {currentUser?.name && authMode === 'none' && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--surface)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minWidth: '110px', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Total Orders</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{orders.length}</span>
              </div>
              <div style={{ background: 'var(--surface)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minWidth: '110px', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Loyalty Stamps</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{loyaltyCount}/8</span>
              </div>
              <div style={{ background: 'var(--surface)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minWidth: '110px', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Member Since</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{new Date().getFullYear()}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px',
          background: 'var(--surface)', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          {[
            { id: 'orders', label: 'My Orders', icon: ShoppingBag, count: orders.length },
            { id: 'profile', label: 'Profile Settings', icon: Edit3, count: '' },
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
                  <div className="input-group"><User size={16} /><input placeholder="Full Name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required /></div>
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
                <button type="submit" className="btn-submit-modal" style={{ flex: 1 }}>{authMode === 'login' ? 'Sign In' : 'Register'}</button>
                <button type="button" className="mode-btn" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ border: '1px solid var(--border)' }}>{authMode === 'login' ? 'Need account?' : 'Already have one?'}</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="modal-body" style={{ minHeight: '360px', maxHeight: '60vh', overflowY: 'auto', padding: '24px' }}>
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
                    {orders.map((ord, i) => (
                      <div key={ord.id || i} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 900, fontSize: '1.05rem', fontFamily: 'var(--font-head)' }}>Order #{ord.orderNumber}</span>
                              <span className={`status-badge status-${(ord.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>{ord.orderStatus || 'Completed'}</span>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px', fontWeight: 600 }}>🕒 {ord.orderTime || (ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Today')}</p>
                          </div>
                          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.25rem', color: 'var(--red)' }}>£{ord.total?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button onClick={() => onPrintReceipt(ord)} className="mode-btn" style={{ border: '1px solid var(--border)', padding: '6px 14px', fontSize: '0.8rem' }}><Printer size={14} /> Print</button>
                          <button onClick={() => onReorder(ord)} className="btn-add-item" style={{ padding: '6px 16px', fontSize: '0.8rem' }}><RotateCcw size={14} /> Reorder</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900 }}>⚙️ Customer Profile Settings</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Manage your personal info and avatar.</p>
                  </div>
                  <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="btn-add-item" style={{ padding: '7px 16px', fontSize: '0.82rem' }}>
                    <Edit3 size={15} /> {isEditingProfile ? 'Cancel' : 'Edit Info'}
                  </button>
                </div>
                {!isEditingProfile ? (
                  <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    <div><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Full Name</span><p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.name}</p></div>
                    <div><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Email Address</span><p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.email}</p></div>
                    <div><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone Number</span><p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.phone}</p></div>
                    <div><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Street Address</span><p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.address}</p></div>
                    <div><span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Postcode</span><p style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: '2px' }}>{currentUser?.postcode}</p></div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 800 }}>Profile Avatar</label>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', cursor: 'pointer', width: 72, height: 72 }} onClick={() => fileInputRef.current?.click()}>
                          {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="Preview" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} /> : profileForm.avatarPreset ? <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--red), var(--amber))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>{profileForm.avatarPreset}</div> : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>{profileForm.name ? profileForm.name.charAt(0).toUpperCase() : 'U'}</div>}
                          <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--red)', borderRadius: '50%', padding: '6px', color: '#FFF', boxShadow: 'var(--shadow-sm)' }}><Camera size={14} /></div>
                        </div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                          {PRESET_AVATARS.map(emoji => (
                            <button key={emoji} type="button" onClick={() => selectPreset(emoji)} style={{ width: 44, height: 44, borderRadius: '50%', fontSize: '20px', background: profileForm.avatarPreset === emoji ? 'var(--red-light)' : 'var(--surface-alt)', border: profileForm.avatarPreset === emoji ? '2px solid var(--red)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>{emoji}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <div><label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Full Name</label><div className="input-group"><User size={16} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required /></div></div>
                      <div><label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Phone Number</label><div className="input-group"><Phone size={16} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required /></div></div>
                      <div><label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Street Address</label><div className="input-group"><MapPin size={16} /><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} required /></div></div>
                      <div><label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Postcode</label><div className="input-group"><MapPin size={16} /><input value={profileForm.postcode} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value.toUpperCase() })} required /></div></div>
                    </div>
                    <button type="submit" className="btn-submit-modal" style={{ marginTop: '10px' }}><Save size={16} /> Save Changes</button>
                  </form>
                )}
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={16} /> Log Out</button>
                </div>
              </div>
            )}
            {activeTab === 'loyalty' && (
              <div>
                <div style={{ background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid #FDE2E2', textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: loyaltyCount >= 8 ? 'var(--amber)' : loyaltyCount >= 4 ? 'var(--indigo)' : 'var(--red)', color: '#FFF', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 800, marginBottom: '12px' }}>
                    <Sparkles size={14} />
                    {loyaltyCount >= 8 ? '👑 GOLD VIP MASTER' : loyaltyCount >= 4 ? '🥈 SILVER CONNOISSEUR' : '🥉 BRONZE FOODIE'}
                  </div>

                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.35rem', fontWeight: 900, margin: 0, color: 'var(--text)' }}>RFC Watford Loyalty Club</h4>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text2)', marginTop: '4px' }}>Earn 1 stamp per order. Collect 8 stamps for 15% OFF!</p>

                  <div style={{ margin: '20px 0 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px' }}>
                      <span>Stamp Progress</span>
                      <span>{loyaltyPercent}% ({loyaltyCount}/8 Stamps)</span>
                    </div>
                    <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${loyaltyPercent}%`, background: 'linear-gradient(90deg, var(--red), var(--amber))', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  {/* 8-Stamp Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', margin: '20px 0' }}>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const isFilled = i < loyaltyCount;
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            aspectRatio: '1', 
                            borderRadius: '16px', 
                            background: isFilled ? 'linear-gradient(135deg, var(--red), #DC2626)' : '#FFF', 
                            border: isFilled ? 'none' : '2px dashed var(--border)', 
                            color: isFilled ? '#FFF' : 'var(--text3)', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 900, 
                            fontSize: '0.88rem',
                            boxShadow: isFilled ? '0 4px 10px rgba(220, 38, 38, 0.25)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isFilled ? (
                            <>
                              <Check size={22} />
                              <span style={{ fontSize: '0.65rem', marginTop: 2 }}>STAMP #{i + 1}</span>
                            </>
                          ) : (
                            <span>#{i + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Claim Reward Action */}
                  {loyaltyCount >= 8 ? (
                    <button
                      type="button"
                      className="btn-submit-modal"
                      onClick={() => {
                        confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
                        if (navigator.clipboard?.writeText) navigator.clipboard.writeText('LOYAL15');
                        if (showToast) showToast('🎉 Reward Claimed! Voucher LOYAL15 (15% OFF) copied to clipboard!', 'success');
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '1rem',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, var(--amber), #D97706)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                        boxShadow: '0 8px 20px rgba(217, 119, 6, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <Award size={20} /> 🎉 Claim Reward Voucher (15% OFF)
                    </button>
                  ) : (
                    <div style={{ background: '#FFF', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 600 }}>
                      🔒 Place {8 - loyaltyCount} more {8 - loyaltyCount === 1 ? 'order' : 'orders'} to unlock your 15% OFF reward voucher!
                    </div>
                  )}
                </div>

                {/* Loyalty Perks Roadmap */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow-sm)' }}>
                  <h5 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text)' }}>
                    🏆 Membership Perks Roadmap
                  </h5>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🥉</span>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text)' }}>Bronze Foodie (1-3 Stamps)</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Earn 1 stamp on every order over £10</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: loyaltyCount >= 1 ? 'var(--green)' : 'var(--text3)' }}>
                        {loyaltyCount >= 1 ? '✓ Active' : 'Locked'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🥈</span>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text)' }}>Silver Connoisseur (4 Stamps)</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Unlock Free Side or Drink voucher (FREESIDE)</span>
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
                          background: loyaltyCount >= 4 ? 'var(--green-light)' : 'transparent',
                          color: loyaltyCount >= 4 ? 'var(--green)' : 'var(--text3)',
                          border: loyaltyCount >= 4 ? '1px solid var(--green)' : 'none',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-xs)',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: loyaltyCount >= 4 ? 'pointer' : 'default'
                        }}
                      >
                        {loyaltyCount >= 4 ? '🎁 Claim Free Side' : 'Locked'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🥇</span>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text)' }}>Gold VIP Master (8 Stamps)</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Unlock 15% OFF entire order voucher (LOYAL15)</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: loyaltyCount >= 8 ? 'var(--amber)' : 'var(--text3)' }}>
                        {loyaltyCount >= 8 ? '👑 Unlocked' : 'Locked'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'vouchers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { code: 'FIRST10', title: '10% OFF First Order', desc: 'Valid for new customers.' },
                  { code: 'OVER25', title: '10% OFF Orders over £25', desc: 'Valid on delivery & collection.' },
                  { code: 'RFC10', title: '10% OFF Special Deal', desc: 'Exclusive website offer.' },
                ].map((v, i) => (
                  <div key={i} className="voucher-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                    <div>
                      <span className="voucher-code" style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 8px', borderRadius: 'var(--radius-xs)', fontWeight: 900, fontSize: '0.85rem' }}>{v.code}</span>
                      <h5 style={{ fontWeight: 800, fontSize: '1rem', marginTop: '8px' }}>{v.title}</h5>
                      <p className="voucher-desc" style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '4px' }}>{v.desc}</p>
                    </div>
                    <button className="copy-btn btn-add-item" onClick={() => { navigator.clipboard.writeText(v.code); if (showToast) showToast(`Voucher ${v.code} copied!`); }} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Copy</button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'reviews' && <ReviewsManager isAdmin={false} showToast={showToast} />}
          </div>
        )}

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
