import { useCallback, useState, useEffect } from 'react';
import { 
  X, User, ShoppingBag, MapPin, Printer, RotateCcw, Sparkles,
  Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle,
  ShieldCheck, ArrowLeft, Clock,
  Eye, EyeOff, Check, Tag
} from 'lucide-react';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { getCurrentUser, getCustomerOrders, updateCustomerProfile, loginCustomer, registerCustomer, logoutCustomer } from '../services/customerAuth';
import { deleteCurrentCustomer } from '../services/api';

const EMPTY_PROFILE = { name: '', phone: '', email: '', address: '', postcode: '' };
const EMPTY_AUTH_FORM = { name: '', email: '', password: '', phone: '', address: '', postcode: '', consentAccepted: false };


export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, onAccountDeleted, showToast }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [currentUser, setCurrentUser] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);

  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [_isSessionLoading, setIsSessionLoading] = useState(false);

  const [accountOrders, setAccountOrders] = useState([]);
  const [isOrderHistoryLoading, setIsOrderHistoryLoading] = useState(false);

  // Auth Mode State
  const [authMode, setAuthMode] = useState('none'); // 'none', 'login', 'register'
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isAuthenticated = currentUser?.role === 'customer' && Boolean(currentUser?.id);
  const visibleOrders = isAuthenticated ? accountOrders : orders;

  const loadAccountOrders = useCallback(async () => {
    setIsOrderHistoryLoading(true);
    try {
      const history = await getCustomerOrders(1, 20);
      const next = Array.isArray(history) ? history : [];
      setAccountOrders(next);
      return next;
    } catch (error) {
      setAccountOrders([]);
      showToast?.(error.message || 'Could not load your order history.', 'error');
      return [];
    } finally {
      setIsOrderHistoryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let isActive = true;
    setIsSessionLoading(true);
    try {
      window.localStorage.removeItem('rfc_customer_profile');
    } catch {
      // Best-effort cleanup of the legacy profile cache.
    }

    getCurrentUser()
      .then(async (user) => {
        if (!isActive) return;
        setCurrentUser(user);
        setProfileForm(user ? {
          name: user.name || '',
          phone: user.phone || '',
          email: user.email || '',
          address: user.address || '',
          postcode: user.postcode || ''
        } : EMPTY_PROFILE);
        if (user) {
          await loadAccountOrders();
        } else {
          setAccountOrders([]);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setCurrentUser(null);
        setProfileForm(EMPTY_PROFILE);
        setAccountOrders([]);
        showToast?.(error.message || 'Could not load the customer account.', 'error');
      })
      .finally(() => {
        if (isActive) setIsSessionLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, loadAccountOrders, showToast]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      const updated = await updateCustomerProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
        postcode: profileForm.postcode
      });
      setCurrentUser(updated);
      setProfileForm({
        name: updated.name || '',
        phone: updated.phone || '',
        email: updated.email || '',
        address: updated.address || '',
        postcode: updated.postcode || ''
      });
      setIsEditingProfile(false);
      showToast?.('Profile details saved.');
    } catch (error) {
      showToast?.(error.message || 'Profile changes could not be saved.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (isAuthSubmitting) return;

    if (authMode === 'register' && !authForm.consentAccepted) {
      setAuthError('You must consent to the privacy policy to create an account.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        const res = await loginCustomer(authForm.email, authForm.password);
        if (!res?.user) throw new Error('The server did not return a customer session.');
        setCurrentUser(res.user);
        setProfileForm({ name: res.user.name || '', phone: res.user.phone || '', email: res.user.email || '', address: res.user.address || '', postcode: res.user.postcode || '' });
        await loadAccountOrders();
        showToast?.(`Welcome back, ${res.user.name}.`);
      } else if (authMode === 'register') {
        const newUser = await registerCustomer({ ...authForm, consentAccepted: true });
        if (!newUser?.id) throw new Error('The server did not create a customer account.');
        setCurrentUser(newUser);
        setProfileForm({ name: newUser.name || '', phone: newUser.phone || '', email: newUser.email || '', address: newUser.address || '', postcode: newUser.postcode || '' });
        await loadAccountOrders();
        showToast?.(`Account created. Welcome, ${newUser.name}.`);
      }
      setAuthMode('none');
      setAuthForm(EMPTY_AUTH_FORM);
    } catch (error) {
      const message = error.message || 'Authentication failed. Please try again.';
      setAuthError(message);
      showToast?.(message, 'error');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!isAuthenticated) {
      setAuthMode('login');
      return;
    }
    try {
      await logoutCustomer();
      setCurrentUser(null);
      setProfileForm(EMPTY_PROFILE);
      setAccountOrders([]);
      setIsEditingProfile(false);
      showToast?.('Logged out of customer account.', 'info');
    } catch (error) {
      showToast?.(error.message || 'Could not log out. Please try again.', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (!isAuthenticated || isDeletingAccount) return;
    if (!window.confirm('Delete and anonymise your customer account? This cannot be undone.')) return;

    setIsDeletingAccount(true);
    try {
      await deleteCurrentCustomer();
      setCurrentUser(null);
      setProfileForm(EMPTY_PROFILE);
      setAccountOrders([]);
      setIsEditingProfile(false);
      onAccountDeleted?.();
      setAuthMode('login');
      showToast?.('Your customer account has been deleted and personal order data anonymised.', 'info');
    } catch (error) {
      showToast?.(error.message || 'The account could not be deleted.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Render User Avatar Icon / Image
  const renderUserAvatar = (size = 64) => {
    const initial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

    return (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--red), var(--amber))',
        color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: `${size * 0.45}px`, boxShadow: 'var(--shadow-red)',
        border: '3px solid #FFF', position: 'relative'
      }}>
        {initial}
      </div>
    );
  };

  const TABS = [
    { id: 'orders', label: 'My Orders', icon: ShoppingBag, count: visibleOrders.length },
    { id: 'profile', label: 'Profile Settings', icon: Edit3, count: '' },
    { id: 'reviews', label: 'Reviews & Feedback', icon: MessageSquare, count: '' },
  ];

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC', width: '100vw', overflow: 'hidden' }}>
      
      <main className="customer-dashboard-container" style={{ flex: 1, minHeight: 0, width: '100%', height: '100%', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {authMode !== 'none' ? (
          <div className="customer-auth-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', position: 'relative' }}>
            <div className={`customer-auth-card ${authMode === 'register' ? 'is-register' : 'is-login'}`} style={{
              width: '100%',
              maxWidth: authMode === 'register' ? '1000px' : '920px',
              maxHeight: '660px',
              gridTemplateColumns: '1fr 1fr',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)',
              border: 'none',
              background: '#FFF',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Left Brand Hero Panel (Rich RFC Crimson & Amber Palette) */}
              <div className="customer-auth-benefits" style={{
                background: 'linear-gradient(145deg, #0F172A 0%, #1E1B2E 35%, #C8102E 85%, #E52929 100%)',
                position: 'relative',
                overflow: 'hidden',
                padding: '40px 36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                {/* Abstract Diagonal Gradient Pill Graphics */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    left: '-30px',
                    width: '180px',
                    height: '55px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.25), rgba(245,158,11,0.5))',
                    transform: 'rotate(-42deg)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '50px',
                    width: '240px',
                    height: '65px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(245,158,11,0.6))',
                    transform: 'rotate(-42deg)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '90px',
                    left: '140px',
                    width: '160px',
                    height: '45px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.2), rgba(229,41,41,0.5))',
                    transform: 'rotate(-42deg)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '60px',
                    right: '-20px',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)'
                  }} />
                </div>

                {/* Left Content Area */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div className="customer-auth-kicker" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                    <img
                      src="/assets/rfc.png"
                      alt="RFC Logo"
                      style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <span style={{ color: '#FFF', fontWeight: 900, fontSize: '0.78rem' }}>RFC WATFORD PORTAL</span>
                  </div>

                  <h1 style={{ fontFamily: 'var(--font-head)', fontSize: '2.2rem', fontWeight: 900, color: '#FFF', lineHeight: 1.15, marginTop: '20px', marginBottom: '12px' }}>
                    Welcome to RFC Watford
                  </h1>

                  <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '360px', margin: 0, fontWeight: 500 }}>
                    Freshly prepared artisan fried chicken, stacked box meals, peri peri & hot wings delivered fresh in Watford.
                  </p>

                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', padding: '4px', display: 'flex' }}>✓</span> 1-Click Order Tracking & History
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', padding: '4px', display: 'flex' }}>✓</span> Fast Local Watford Delivery
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', padding: '4px', display: 'flex' }}>✓</span> Member Vouchers & Stamp Rewards
                    </div>
                  </div>
                </div>

                {/* Left Bottom Footer */}
                <div style={{ position: 'relative', zIndex: 2, paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#FFF', fontWeight: 700 }}>
                  <span>📍 119 Courtlands Drive</span>
                  <span>📞 01923 677407</span>
                </div>
              </div>

              {/* Right Form Panel */}
              <div className="customer-auth-form-panel" style={{
                padding: '32px 36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: '#FFF',
                position: 'relative'
              }}>
                {/* Top Actions Bar: Back to Menu & Close */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setAuthMode('none')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-full)',
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <ArrowLeft size={14} /> Back to Menu
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode('none')}
                    aria-label="Close portal"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Mode Switch Pills */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <div className="customer-auth-segment" style={{ width: '100%', maxWidth: '280px', borderRadius: '9999px', padding: '4px', background: '#F1F5F9', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setAuthError(''); }}
                      className={`customer-auth-segment-btn ${authMode === 'login' ? 'active' : ''}`}
                      style={{ borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 800 }}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('register'); setAuthError(''); }}
                      className={`customer-auth-segment-btn ${authMode === 'register' ? 'active' : ''}`}
                      style={{ borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 800 }}
                    >
                      Register
                    </button>
                  </div>
                </div>

                {/* Form Header */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--red)', letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>
                    {authMode === 'login' ? 'USER LOGIN' : 'CREATE ACCOUNT'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text2)', margin: '4px 0 0 0', fontWeight: 600 }}>
                    {authMode === 'login' ? 'Please enter your account credentials' : 'Fill in your details to create an account'}
                  </p>
                </div>

                {authError && (
                  <div className="customer-auth-error" style={{ borderRadius: '9999px', padding: '8px 16px', fontSize: '0.82rem', justifyContent: 'center', marginBottom: '12px' }}>
                    <AlertTriangle size={15} /> {authError}
                  </div>
                )}

                {/* Form with High-Contrast Soft Inputs */}
                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {authMode === 'register' && (
                    <div>
                      <div className="input-group" style={{ borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 18px', height: '44px' }}>
                        <User size={16} color="var(--red)" />
                        <input
                          autoComplete="name"
                          placeholder="Full Name"
                          value={authForm.name}
                          onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                          required
                          style={{ fontSize: '0.88rem', color: 'var(--text)', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="input-group" style={{ borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 18px', height: '44px' }}>
                      <Mail size={16} color="var(--red)" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="Email Address"
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        required
                        style={{ fontSize: '0.88rem', color: 'var(--text)', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="input-group" style={{ position: 'relative', borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 18px', height: '44px' }}>
                      <Lock size={16} color="var(--red)" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        minLength={authMode === 'login' ? 8 : 12}
                        maxLength={128}
                        placeholder="Password"
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        required
                        style={{ fontSize: '0.88rem', color: 'var(--text)', paddingRight: '30px', fontWeight: 600 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex' }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <>
                      <div>
                        <div className="input-group" style={{ borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 18px', height: '44px' }}>
                          <Phone size={16} color="var(--red)" />
                          <input
                            autoComplete="tel"
                            placeholder="Phone Number (e.g. 07123 456789)"
                            value={authForm.phone}
                            onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                            style={{ fontSize: '0.88rem', color: 'var(--text)', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                      <div className="customer-auth-address-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '8px' }}>
                        <div>
                          <div className="input-group" style={{ borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 16px', height: '44px' }}>
                            <MapPin size={16} color="var(--red)" />
                            <input
                              autoComplete="street-address"
                              placeholder="Street Address"
                              value={authForm.address}
                              onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })}
                              style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="input-group" style={{ borderRadius: '9999px', background: '#F8FAFC', border: '1.5px solid #CBD5E1', padding: '0 14px', height: '44px' }}>
                            <MapPin size={16} color="var(--red)" />
                            <input
                              autoComplete="postal-code"
                              placeholder="Postcode"
                              value={authForm.postcode}
                              onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value.toUpperCase() })}
                              style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Sub-row Options & Back to Login Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text2)', padding: '0 4px', margin: '2px 0 4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        defaultChecked
                        style={{ accentColor: 'var(--red)', borderRadius: '4px' }}
                      />
                      <span>Remember</span>
                    </label>

                    {authMode === 'register' ? (
                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setAuthError(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        ← Back to Sign In
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showToast?.('Please contact support or reset password via your registered email.', 'info')}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  {authMode === 'register' && (
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'var(--text2)', lineHeight: 1.4, padding: '0 4px' }}>
                      <input
                        type="checkbox"
                        checked={authForm.consentAccepted}
                        onChange={(event) => setAuthForm({ ...authForm, consentAccepted: event.target.checked })}
                        required
                        style={{ marginTop: '2px', accentColor: 'var(--red)' }}
                      />
                      <span>I consent to the privacy policy for processing my customer account & order details.</span>
                    </label>
                  )}

                  {/* Centered Crimson Pill Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      style={{
                        width: '210px',
                        height: '46px',
                        borderRadius: '9999px',
                        background: 'linear-gradient(135deg, var(--red) 0%, #C8102E 100%)',
                        color: '#FFF',
                        fontFamily: 'var(--font-head)',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        letterSpacing: '0.8px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-red)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {isAuthSubmitting ? 'PLEASE WAIT…' : (authMode === 'login' ? 'LOGIN' : 'REGISTER')}
                    </button>
                  </div>
                </form>

                {/* Additional Back to Login link when in Register mode */}
                {authMode === 'register' && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setAuthError(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Already have an account? <strong style={{ color: 'var(--red)', textDecoration: 'underline' }}>Sign In here</strong>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '0', height: '100%', minHeight: 0, width: '100%', overflow: 'hidden' }}>
            <style>{`
              @media (max-width: 899px) {
                .portal-grid { display: flex !important; flex-direction: column !important; overflow-y: auto !important; }
                .customer-dashboard-container { overflow-y: auto !important; }
              }
            `}</style>

            {/* Dark Sidebar (Full Height Edge-to-Edge TailAdmin Layout) */}
            <aside style={{ background: '#1C2434', borderRadius: 0, color: '#DEE4EE', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', padding: '24px 18px', borderRight: '1px solid rgba(255,255,255,0.05)', boxShadow: '4px 0 20px rgba(0,0,0,0.08)' }}>
              
              {/* Brand Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}>
                <img src="/assets/rfc.png" alt="RFC Logo" style={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'cover' }} />
                <div>
                  <strong style={{ fontFamily: 'var(--font-head)', fontSize: '1.1rem', color: '#FFF', display: 'block', lineHeight: 1.1 }}>
                    RFC Portal
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: '#8A99AD', fontWeight: 700 }}>Customer Account & Rewards</span>
                </div>
              </div>

              {/* Profile Card */}
              <div style={{ padding: '12px', background: '#24303F', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {renderUserAvatar(42)}
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: '#10B981', borderRadius: '50%', border: '2px solid #24303F' }}></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 900, color: '#FFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentUser?.name || 'Valued Customer'}
                    </h3>
                    <span style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldCheck size={10} /> {isAuthenticated ? 'VIP Customer' : 'Guest Mode'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#8A99AD', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px', paddingLeft: '8px' }}>
                    MY ACCOUNT
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {TABS.map(t => {
                      const Icon = t.icon;
                      const isActive = activeTab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: '8px',
                            background: isActive ? '#333A48' : 'transparent',
                            color: isActive ? '#FFF' : '#8A99AD',
                            border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                            fontWeight: isActive ? 800 : 600, fontSize: '0.85rem'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icon size={16} color={isActive ? 'var(--red)' : '#8A99AD'} />
                            <span>{t.label}</span>
                          </span>
                          {t.count && (
                            <span style={{ background: isActive ? 'var(--red)' : 'rgba(255,255,255,0.1)', color: '#FFF', padding: '2px 7px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 800 }}>
                              {t.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={() => setAuthMode('login')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      background: 'transparent', border: 'none', borderRadius: '8px',
                      cursor: 'pointer', color: '#8A99AD', fontWeight: 600, fontSize: '0.85rem', width: '100%'
                    }}
                  >
                    <Lock size={15} />
                    <span>Switch Account</span>
                  </button>

                  {isAuthenticated && (
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', padding: '10px 12px',
                        background: 'rgba(225, 29, 72, 0.15)', border: '1px solid rgba(225, 29, 72, 0.3)', borderRadius: '8px',
                        cursor: 'pointer', color: '#F43F5E', fontWeight: 800, fontSize: '0.85rem', width: '100%'
                      }}
                    >
                      <LogOut size={15} />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* Right Content Area (Full Height Edge-to-Edge) */}
            <div style={{ background: '#F8FAFC', borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              
              {/* Content Top Navbar */}
              <div style={{ padding: '14px 24px', background: '#FFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 900, color: '#1E293B', margin: 0 }}>
                    Welcome Back, {currentUser?.name || 'Customer'}! 👋
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                    Store: RFC Watford • 119 Courtlands Drive (01923 677407)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={onClose}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'var(--red)', color: '#FFF', border: 'none',
                      padding: '8px 16px', borderRadius: '9999px', fontSize: '0.82rem',
                      fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow-red)'
                    }}
                  >
                    <span>Order Food Now</span>
                  </button>

                  <button
                    onClick={onClose}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#F1F5F9', border: '1px solid #E2E8F0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#64748B', cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Scrollable Main Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>
                
                {/* 4 KPI Summary Cards Grid (TailAdmin Style) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Orders Placed</span>
                      <ShoppingBag size={18} color="var(--red)" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem', fontWeight: 900, color: '#1E293B' }}>
                      {visibleOrders.length} Orders
                    </div>
                  </div>

                  <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Stamp Rewards</span>
                      <Sparkles size={18} color="#D97706" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem', fontWeight: 900, color: '#D97706' }}>
                      {visibleOrders.length * 50} Pts
                    </div>
                  </div>

                  <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Postcode Zone</span>
                      <MapPin size={18} color="#059669" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentUser?.postcode || 'WD17 4HZ'}
                    </div>
                  </div>

                  <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Active Order</span>
                      <Clock size={18} color="#2563EB" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.1rem', fontWeight: 900, color: '#2563EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {visibleOrders[0] ? `#${visibleOrders[0].orderNumber}` : 'No Active Order'}
                    </div>
                  </div>
                </div>

                {activeTab === 'orders' && (
                  <div>
                    {isOrderHistoryLoading ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>Loading order history…</div>
                    ) : visibleOrders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                        <ShoppingBag size={52} strokeWidth={1.2} style={{ marginBottom: '12px', color: 'var(--red)' }} />
                        <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>No Orders Placed Yet</h4>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text2)', marginTop: '6px', marginBottom: '20px' }}>Place an order to see it here and make future reordering easier.</p>
                        <button onClick={onClose} className="btn-add-item" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
                          Browse Menu & Order
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {visibleOrders.map((ord, i) => (
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
                    {!isAuthenticated ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                        <Lock size={38} style={{ color: 'var(--red)', marginBottom: '10px' }} />
                        <h3>Sign in to manage your profile</h3>
                        <p style={{ color: 'var(--text2)', margin: '6px 0 18px' }}>Profile details are loaded from your secure server session and are not stored in this browser.</p>
                        <button type="button" className="btn-submit-modal" style={{ width: 'auto', padding: '9px 22px' }} onClick={() => setAuthMode('login')}>Sign In</button>
                      </div>
                    ) : !isEditingProfile ? (
                      <>
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
                        <div style={{ marginTop: '24px', padding: '18px', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', background: '#FEF2F2' }}>
                          <h4 style={{ color: '#991B1B', margin: 0 }}>Delete account</h4>
                          <p style={{ color: '#7F1D1D', fontSize: '0.82rem', margin: '6px 0 12px' }}>Your account will be disabled and personal details in historical orders will be anonymised. This cannot be undone.</p>
                          <button type="button" disabled={isDeletingAccount} onClick={handleDeleteAccount} className="mode-btn" style={{ border: '1px solid #DC2626', color: '#B91C1C', background: '#FFF', padding: '8px 14px' }}>
                            {isDeletingAccount ? 'Deleting…' : 'Delete my account'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', background: 'var(--surface-alt)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Full Name</label>
                            <div className="input-group"><User size={15} /><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required style={{ padding: '8px 12px', fontSize: '0.88rem' }} /></div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px', display: 'block' }}>Email Address</label>
                            <div className="input-group"><Mail size={15} /><input value={profileForm.email} readOnly aria-readonly="true" style={{ padding: '8px 12px', fontSize: '0.88rem', background: 'var(--surface-alt)' }} /></div>
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
                          <button type="submit" disabled={isSavingProfile} className="btn-submit-modal" style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={15} /> {isSavingProfile ? 'Saving…' : 'Save Changes'}</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {activeTab === 'loyalty' && (() => {
                  const loyaltyCount = visibleOrders.length;
                  const currentStamps = loyaltyCount % 8;
                  const loyaltyPercent = Math.min(100, Math.round((currentStamps / 8) * 100));
                  return (
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
                        <div style={{ background: '#FFF', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 700 }}>
                          Loyalty progress shown here is an estimate from this browser session. Reward claiming will be enabled when server-issued vouchers are available.
                        </div>
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
                              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Future server-issued free side or drink reward</span>
                            </div>
                          </div>
                          <span style={{ background: 'var(--surface-alt)', color: 'var(--text3)', padding: '5px 12px', borderRadius: 'var(--radius-full)', fontWeight: 800, fontSize: '0.75rem' }}>
                            Server voucher required
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFF', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>🥇</span>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800 }}>Gold VIP Master (8 Stamps)</strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Future server-issued order discount reward</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 900, color: loyaltyCount >= 8 ? 'var(--amber)' : 'var(--text3)', background: loyaltyCount >= 8 ? '#FEF3C7' : 'var(--surface-alt)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}>
                            {loyaltyCount >= 8 ? '👑 Unlocked' : 'Locked'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ); })()}

                {activeTab === 'vouchers' && (
                  <div style={{ textAlign: 'center', padding: '44px 20px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                    <Tag size={42} style={{ color: 'var(--red)', marginBottom: '10px' }} />
                    <h3>No server-issued vouchers</h3>
                    <p style={{ color: 'var(--text2)', marginTop: '6px' }}>Eligible vouchers will appear here after the account rewards service is enabled.</p>
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
          if (!onCancelOrder) return;
          Promise.resolve(onCancelOrder(orderId, reason)).then(() => {
            if (isAuthenticated) loadAccountOrders();
          });
        }}
      />
    </div>
  );
}
