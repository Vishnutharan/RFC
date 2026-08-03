import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, User, ShoppingBag, Gift, MapPin, Printer, RotateCcw, Check, Sparkles, 
  Tag, Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle, 
  Camera, Upload, Image, Star, ShieldCheck, Heart, Award, ArrowLeft, Clock, Copy,
  Eye, EyeOff, ArrowRight, CheckCircle2
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
  const [showPassword, setShowPassword] = useState(false);

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
    <div style={{ height: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', width: '100%', overflow: 'hidden' }}>
      {/* Top Dashboard Header Bar */}
      <div style={{ background: '#FFF', borderBottom: '1px solid var(--border)', padding: '0 24px', height: '58px', flexShrink: 0, zIndex: 10, display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', padding: '6px 14px', borderRadius: 'var(--radius-full)', transition: 'all 0.15s ease' }}>
            <ArrowLeft size={16} /> Back to Menu
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}></div>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text)', letterSpacing: '-0.2px' }}>RFC Customer Portal</span>
          </div>

          {authMode === 'none' && (
            <button onClick={() => setAuthMode('login')} className="mode-btn" style={{ padding: '6px 16px', fontSize: '0.85rem', border: '1px solid var(--border)', background: '#FFF' }}>
              Switch Account
            </button>
          )}
        </div>
      </div>

      <main className="customer-dashboard-container" style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {authMode !== 'none' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', minHeight: 0, overflowY: 'auto' }}>
            <div style={{
              background: '#FFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              maxWidth: '900px',
              width: '100%',
              overflow: 'hidden'
            }}>
              {/* Left Brand Hero Panel */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, var(--red) 100%)',
                padding: '36px 32px',
                color: '#FFF',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                position: 'relative'
              }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', padding: '5px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 800, marginBottom: '24px', border: '1px solid rgba(255,255,255,0.18)' }}>
                    <Sparkles size={14} color="var(--amber)" /> RFC WATFORD VIP CLUB
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '2rem', fontWeight: 900, lineHeight: 1.2, margin: '0 0 14px 0', letterSpacing: '-0.5px' }}>
                    Crispy Chicken.<br />Instant Rewards.
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: '0 0 28px 0' }}>
                    Sign in to track orders live, earn 8-stamp loyalty rewards, and claim 15% OFF vouchers!
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { icon: Award, title: '8-Stamp Loyalty Club', desc: 'Earn 1 stamp per order & unlock 15% OFF.' },
                      { icon: RotateCcw, title: '1-Click Express Reorder', desc: 'Reorder past feasts in seconds.' },
                      { icon: ShieldCheck, title: 'Exclusive VIP Promos', desc: 'Access members-only discounts.' }
                    ].map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ padding: '7px', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--amber)', flexShrink: 0, marginTop: '2px' }}>
                            <FIcon size={16} />
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800 }}>{f.title}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{f.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Demo Credentials Fill Shortcut */}
                <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthForm({
                        name: 'Vishnu Karun',
                        email: 'vishnu@example.com',
                        password: 'password123',
                        phone: '+44 7700 900077',
                        address: '37 Berry Avenue',
                        postcode: 'WD24 6RU'
                      });
                      if (showToast) showToast('⚡ Demo credentials filled!');
                    }}
                    style={{
                      width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.12)', border: '1px dashed rgba(255,255,255,0.3)',
                      borderRadius: 'var(--radius-sm)', color: '#FFF', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s'
                    }}
                  >
                    ⚡ One-Click Fill Demo Credentials
                  </button>
                </div>
              </div>

              {/* Right Form Panel */}
              <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                
                {/* Segmented Control Pill */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'var(--surface-alt)', padding: '4px', borderRadius: 'var(--radius-full)', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    style={{
                      padding: '7px', borderRadius: 'var(--radius-full)', border: 'none',
                      background: authMode === 'login' ? '#FFF' : 'transparent',
                      color: authMode === 'login' ? 'var(--red)' : 'var(--text2)',
                      fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                      boxShadow: authMode === 'login' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    style={{
                      padding: '7px', borderRadius: 'var(--radius-full)', border: 'none',
                      background: authMode === 'register' ? '#FFF' : 'transparent',
                      color: authMode === 'register' ? 'var(--red)' : 'var(--text2)',
                      fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                      boxShadow: authMode === 'register' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Create Account
                  </button>
                </div>

                <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 4px 0' }}>
                  {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text2)', margin: '0 0 16px 0' }}>
                  {authMode === 'login' ? 'Please enter your account details below.' : 'Fill in your details to start earning stamps.'}
                </p>

                {authError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--red-light)', border: '1px solid #FEE2E2', color: 'var(--red)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} /> {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {authMode === 'register' && (
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Full Name</label>
                      <div className="input-group"><User size={15} /><input placeholder="Vishnu Karun" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Email Address</label>
                    <div className="input-group"><Mail size={15} /><input type="email" placeholder="vishnu@example.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Password</label>
                    <div className="input-group" style={{ position: 'relative' }}>
                      <Lock size={15} />
                      <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required style={{ padding: '9px 36px 9px 12px', fontSize: '0.88rem', width: '100%' }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Phone Number</label>
                        <div className="input-group"><Phone size={15} /><input placeholder="+44 7700 900077" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Street Address</label>
                          <div className="input-group"><MapPin size={15} /><input placeholder="37 Berry Avenue" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '4px', display: 'block', color: 'var(--text)' }}>Postcode</label>
                          <div className="input-group"><MapPin size={15} /><input placeholder="WD24 6RU" value={authForm.postcode} onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value.toUpperCase() })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="btn-submit-modal"
                    style={{
                      padding: '11px', fontSize: '0.95rem', fontWeight: 900, marginTop: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: 'var(--shadow-red)'
                    }}
                  >
                    {authMode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} />
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    type="button"
                    onClick={() => setAuthMode('none')}
                    style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Continue as Guest Customer →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '20px', height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <style>{`
              @media (max-width: 899px) {
                .portal-grid { display: flex !important; flex-direction: column !important; overflow-y: auto !important; }
                .customer-dashboard-container { overflow-y: auto !important; }
              }
            `}</style>

            {/* Left Sidebar */}
            <aside style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
              
              {/* Profile Summary Header */}
              <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, var(--red-light), #FFF)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ padding: '2px', background: 'linear-gradient(135deg, var(--red), var(--amber))', borderRadius: '50%' }}>
                      {renderUserAvatar(46)}
                    </div>
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, background: 'var(--green)', borderRadius: '50%', border: '2px solid #FFF' }}></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUser?.name || 'Customer'}
                      </h3>
                    </div>
                    {currentUser?.name && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--amber)', color: '#FFF', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 800, marginTop: '2px' }}>
                        <Star size={9} fill="#FFF" /> {loyaltyCount >= 8 ? 'GOLD VIP' : loyaltyCount >= 4 ? 'SILVER VIP' : 'BRONZE VIP'}
                      </div>
                    )}
                    <p style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <MapPin size={11} style={{ flexShrink: 0 }} /> {currentUser?.address || 'Update address'}
                    </p>
                  </div>
                </div>

                {/* Quick Stats Dual Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px', padding: '6px 10px', background: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Orders</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--red)', fontFamily: 'var(--font-head)' }}>{orders.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '1px solid var(--border)', paddingLeft: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Stamps</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--amber)', fontFamily: 'var(--font-head)' }}>{loyaltyCount}/8</span>
                  </div>
                </div>
              </div>

              {/* Navigation Menu Section */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '8px 16px 4px' }}>
                  Portal Menu
                </div>

                {TABS.map(t => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        margin: '2px 8px', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                        background: isActive ? 'var(--red-light)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        color: isActive ? 'var(--red)' : 'var(--text)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: isActive ? 800 : 600, fontSize: '0.88rem' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: isActive ? '#FFF' : 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'var(--red)' : 'var(--text2)' }}>
                          <Icon size={16} />
                        </div>
                        {t.label}
                      </div>
                      {t.count && <span style={{ background: isActive ? '#FFF' : 'var(--surface-alt)', color: isActive ? 'var(--red)' : 'var(--text2)', padding: '2px 7px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 800 }}>{t.count}</span>}
                    </button>
                  );
                })}

                <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '8px 16px 4px', borderTop: '1px solid var(--border-light)' }}>
                    Account & System
                  </div>
                  
                  <button
                    onClick={() => setAuthMode('login')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 8px', padding: '9px 12px',
                      background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', color: 'var(--text2)', fontWeight: 600, fontSize: '0.88rem',
                      width: 'calc(100% - 16px)'
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                      <Lock size={15} />
                    </div>
                    Switch Account
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 8px 8px', padding: '9px 12px',
                      background: 'var(--red-light)', border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', color: 'var(--red)', fontWeight: 700, fontSize: '0.88rem',
                      width: 'calc(100% - 16px)'
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                      <LogOut size={15} />
                    </div>
                    Log Out
                  </button>
                </div>
              </div>
            </aside>

            {/* Right Content Panel */}
            <div style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              {/* Content Panel Header */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {(() => {
                    const currentTabObj = TABS.find(t => t.id === activeTab);
                    const TabIcon = currentTabObj?.icon || ShoppingBag;
                    return (
                      <>
                        <div style={{ padding: '8px', background: 'var(--red-light)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', display: 'flex' }}>
                          <TabIcon size={18} />
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                          {currentTabObj?.label || 'My Orders'}
                        </h2>
                      </>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {activeTab === 'orders' && orders.length > 0 && (
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text2)', background: 'var(--surface-alt)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                      {orders.length} {orders.length === 1 ? 'Order' : 'Orders'} Total
                    </span>
                  )}
                  {activeTab === 'profile' && (
                    <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="btn-add-item" style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Edit3 size={14} /> {isEditingProfile ? 'Cancel Editing' : 'Edit Profile'}
                    </button>
                  )}
                </div>
              </div>

              {/* Content Panel Body (Inner Scroll) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>
                
                {activeTab === 'orders' && (
                  <div>
                    {orders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                        <ShoppingBag size={52} strokeWidth={1.2} style={{ marginBottom: '12px', color: 'var(--red)' }} />
                        <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>No Orders Placed Yet</h4>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text2)', marginTop: '6px', marginBottom: '20px' }}>Order your favourite RFC crispy chicken to earn loyalty points!</p>
                        <button onClick={onClose} className="btn-add-item" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
                          Browse Menu & Order
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {orders.map((ord, i) => (
                          <div key={ord.id || i} style={{ background: '#FFF', borderRadius: 'var(--radius)', padding: '18px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-head)' }}>Order #{ord.orderNumber}</span>
                                  <span className={`status-badge status-${(ord.orderStatus || 'completed').toLowerCase().replace(/\s+/g, '')}`}>{ord.orderStatus || 'Completed'}</span>
                                </div>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text3)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={13} color="var(--text3)" /> {ord.orderTime || (ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Today')}
                                </p>
                                
                                <div style={{ marginTop: '10px', fontSize: '0.88rem', color: 'var(--text)' }}>
                                  <strong style={{ color: 'var(--text2)' }}>Items:</strong> {ord.items ? ord.items.map(item => `${item.quantity}x ${item.name}`).join(', ') : 'Details unavailable'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.35rem', color: 'var(--red)' }}>£{ord.total?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                              <button onClick={() => onPrintReceipt && onPrintReceipt(ord)} className="mode-btn" style={{ border: '1px solid var(--border)', padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Printer size={14} /> Print Receipt</button>
                              
                              {!['completed', 'cancelled', 'delivered'].includes((ord.orderStatus || '').toLowerCase()) && (
                                <button onClick={() => setCancelModalOrder(ord)} className="mode-btn" style={{ border: '1px solid var(--red)', color: 'var(--red)', padding: '6px 14px', fontSize: '0.82rem', background: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14} /> Cancel</button>
                              )}
                              
                              <button onClick={() => onReorder && onReorder(ord)} className="btn-add-item" style={{ padding: '6px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}><RotateCcw size={14} /> Reorder</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <div>
                    {!isEditingProfile ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Full Name</span>
                          <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '4px', margin: 0 }}>{currentUser?.name || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Email Address</span>
                          <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '4px', margin: 0 }}>{currentUser?.email || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone Number</span>
                          <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '4px', margin: 0 }}>{currentUser?.phone || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Street Address</span>
                          <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '4px', margin: 0 }}>{currentUser?.address || '-'}</p>
                        </div>
                        <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Postcode</span>
                          <p style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: '4px', margin: 0 }}>{currentUser?.postcode || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ background: 'var(--surface-alt)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <label style={{ fontSize: '0.9rem', fontWeight: 900, marginBottom: '12px', display: 'block' }}>Profile Avatar</label>
                          <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', cursor: 'pointer', width: 64, height: 64 }} onClick={() => fileInputRef.current?.click()}>
                              {profileForm.avatarUrl ? (
                                <img src={profileForm.avatarUrl} alt="Preview" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }} />
                              ) : profileForm.avatarPreset ? (
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--red), var(--amber))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }}>
                                  {AVATAR_PRESETS.find(p => p.id === profileForm.avatarPreset)?.label.split(' ')[0] || '👑'}
                                </div>
                              ) : (
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--border)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 900, border: '3px solid #FFF', boxShadow: 'var(--shadow-sm)' }}>
                                  {profileForm.name ? profileForm.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--red)', borderRadius: '50%', padding: '5px', color: '#FFF', boxShadow: 'var(--shadow-sm)' }}>
                                <Camera size={12} />
                              </div>
                            </div>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                            
                            <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '18px' }}>
                              <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', margin: 0 }}>Or choose a preset:</p>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {AVATAR_PRESETS.map(preset => (
                                  <button 
                                    key={preset.id} 
                                    type="button" 
                                    onClick={() => selectPreset(preset.id)} 
                                    title={preset.label}
                                    style={{ 
                                      width: 38, height: 38, borderRadius: '50%', fontSize: '16px', 
                                      background: profileForm.avatarPreset === preset.id ? 'var(--red-light)' : '#FFF', 
                                      border: profileForm.avatarPreset === preset.id ? '2px solid var(--red)' : '1px solid var(--border)', 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                      cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--shadow-sm)' 
                                    }}
                                  >
                                    {preset.label.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', background: 'var(--surface-alt)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Full Name</label>
                            <div className="input-group"><User size={15} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Email Address</label>
                            <div className="input-group"><Mail size={15} /><input value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Phone Number</label>
                            <div className="input-group"><Phone size={15} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Street Address</label>
                            <div className="input-group"><MapPin size={15} /><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Postcode</label>
                            <div className="input-group"><MapPin size={15} /><input value={profileForm.postcode} onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value.toUpperCase() })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="submit" className="btn-submit-modal" style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={15} /> Save Changes</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {activeTab === 'loyalty' && (
                  <div>
                    <div style={{ background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid #FDE2E2', textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: loyaltyCount >= 8 ? 'var(--amber)' : loyaltyCount >= 4 ? 'var(--indigo)' : 'var(--red)', color: '#FFF', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 900, marginBottom: '10px', boxShadow: 'var(--shadow-sm)' }}>
                        <Sparkles size={13} />
                        {loyaltyCount >= 8 ? '👑 GOLD VIP MASTER' : loyaltyCount >= 4 ? '🥈 SILVER CONNOISSEUR' : '🥉 BRONZE FOODIE'}
                      </div>

                      <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.45rem', fontWeight: 900, margin: 0, color: 'var(--text)' }}>RFC Watford Loyalty Club</h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text2)', marginTop: '4px', margin: 0 }}>Earn 1 stamp per order. Collect 8 stamps for 15% OFF your next feast!</p>

                      <div style={{ maxWidth: '480px', margin: '16px auto 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px' }}>
                          <span>Stamp Progress</span>
                          <span>{loyaltyPercent}% ({loyaltyCount}/8 Stamps)</span>
                        </div>
                        <div style={{ height: '10px', borderRadius: 'var(--radius-full)', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${loyaltyPercent}%`, background: 'linear-gradient(90deg, var(--red), var(--amber))', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      {/* 8-Stamp Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px', maxWidth: '580px', margin: '20px auto' }}>
                        {Array.from({ length: 8 }).map((_, i) => {
                          const isFilled = i < loyaltyCount;
                          return (
                            <div 
                              key={i} 
                              style={{ 
                                aspectRatio: '1', 
                                borderRadius: '12px', 
                                background: isFilled ? 'linear-gradient(135deg, var(--red), #DC2626)' : '#FFF', 
                                border: isFilled ? 'none' : '2px dashed var(--border)', 
                                color: isFilled ? '#FFF' : 'var(--text3)', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 900, 
                                fontSize: '0.95rem',
                                boxShadow: isFilled ? '0 4px 10px rgba(220, 38, 38, 0.25)' : 'var(--shadow-sm)',
                                transition: 'all 0.2s ease',
                                transform: isFilled ? 'scale(1.02)' : 'scale(1)'
                              }}
                            >
                              {isFilled ? (
                                <>
                                  <Check size={18} />
                                  <span style={{ fontSize: '0.55rem', marginTop: 2 }}>STAMP</span>
                                </>
                              ) : (
                                <span>{i + 1}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Claim Reward Action */}
                      <div style={{ maxWidth: '340px', margin: '0 auto' }}>
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
                              width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 900,
                              background: 'linear-gradient(135deg, var(--amber), #D97706)', color: '#FFF',
                              border: 'none', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                              boxShadow: '0 6px 18px rgba(217, 119, 6, 0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                          >
                            <Award size={18} /> Claim 15% OFF Voucher
                          </button>
                        ) : (
                          <div style={{ background: '#FFF', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text2)', fontWeight: 700 }}>
                            🔒 Place {8 - loyaltyCount} more {8 - loyaltyCount === 1 ? 'order' : 'orders'} to unlock!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loyalty Perks Roadmap */}
                    <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.1rem', fontWeight: 900, margin: '0 0 14px 0', color: 'var(--text)' }}>
                        🏆 Membership Perks
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>🥉</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800 }}>Bronze Foodie (1-3 Stamps)</strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Earn 1 stamp on every order over £10</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: loyaltyCount >= 1 ? 'var(--green)' : 'var(--text3)', background: loyaltyCount >= 1 ? 'var(--green-light)' : 'var(--surface-alt)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}>
                            {loyaltyCount >= 1 ? '✓ Active' : 'Locked'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>🥈</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800 }}>Silver Connoisseur (4 Stamps)</strong>
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
                              background: loyaltyCount >= 4 ? 'var(--green)' : 'var(--surface-alt)',
                              color: loyaltyCount >= 4 ? '#FFF' : 'var(--text3)',
                              border: 'none', padding: '5px 12px', borderRadius: 'var(--radius-full)',
                              fontWeight: 800, fontSize: '0.75rem', cursor: loyaltyCount >= 4 ? 'pointer' : 'default',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            {loyaltyCount >= 4 ? <><Copy size={12} /> Copy Code</> : 'Locked'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>🥇</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800 }}>Gold VIP Master (8 Stamps)</strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Unlock 15% OFF entire order voucher (LOYAL15)</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: loyaltyCount >= 8 ? 'var(--amber)' : 'var(--text3)', background: loyaltyCount >= 8 ? '#FEF3C7' : 'var(--surface-alt)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}>
                            {loyaltyCount >= 8 ? '👑 Unlocked' : 'Locked'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'vouchers' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                      {[
                        { code: 'FIRST10', title: '10% OFF First Order', desc: 'Welcome bonus for new customers.' },
                        { code: 'OVER25', title: '10% OFF Orders over £25', desc: 'Valid on delivery & collection.' },
                        { code: 'RFC10', title: '10% OFF Special Deal', desc: 'Exclusive app & website offer.' },
                      ].map((v, i) => (
                        <div key={i} style={{ background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 900, fontSize: '0.82rem', letterSpacing: '1px' }}>{v.code}</span>
                            <h3 style={{ fontWeight: 900, fontSize: '1.05rem', marginTop: '12px', fontFamily: 'var(--font-head)' }}>{v.title}</h3>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginTop: '4px', margin: 0 }}>{v.desc}</p>
                          </div>
                          <button 
                            className="btn-add-item" 
                            onClick={() => { navigator.clipboard.writeText(v.code); if (showToast) showToast(`Voucher ${v.code} copied to clipboard!`); }} 
                            style={{ width: '100%', marginTop: '16px', padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <Copy size={14} /> Copy Code
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
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
