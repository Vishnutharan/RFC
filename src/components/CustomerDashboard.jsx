import { useCallback, useState, useEffect } from 'react';
import { 
  X, User, ShoppingBag, MapPin, Printer, RotateCcw, Sparkles,
  Edit3, Save, LogOut, Lock, Mail, Phone, MessageSquare, AlertTriangle,
  ShieldCheck, ArrowLeft, Clock,
  Eye, EyeOff, ArrowRight
} from 'lucide-react';
import ReviewsManager from './ReviewsManager';
import CancelOrderModal from './CancelOrderModal';
import { getCurrentUser, getCustomerOrders, updateCustomerProfile, loginCustomer, registerCustomer, logoutCustomer } from '../services/customerAuth';
import { deleteCurrentCustomer } from '../services/api';

const EMPTY_PROFILE = { name: '', phone: '', email: '', address: '', postcode: '' };
const EMPTY_AUTH_FORM = { name: '', email: '', password: '', phone: '', address: '', postcode: '', consentAccepted: false };

const AUTH_BENEFITS = [
  { icon: Clock, title: 'Live order tracking', desc: 'Follow kitchen and delivery updates from one place.' },
  { icon: ShoppingBag, title: 'Account order history', desc: 'Review recent orders linked to your signed-in account.' },
  { icon: ShieldCheck, title: 'Server-backed profile', desc: 'Manage delivery details through your authenticated account.' }
];

export default function CustomerDashboard({ isOpen, onClose, orders = [], onReorder, onPrintReceipt, onCancelOrder, onAccountDeleted, showToast }) {
  const [activeTab, setActiveTab] = useState('orders');
  const [currentUser, setCurrentUser] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
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
            <button disabled={isSessionLoading} onClick={() => setAuthMode('login')} className="mode-btn" style={{ padding: '6px 16px', fontSize: '0.85rem', border: '1px solid var(--border)', background: '#FFF' }}>
              {isSessionLoading ? 'Loading…' : (isAuthenticated ? 'Switch Account' : 'Sign In')}
            </button>
          )}
          {authMode !== 'none' && <div style={{ width: 128 }} aria-hidden="true" />}
        </div>
      </div>

      <main className="customer-dashboard-container" style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {authMode !== 'none' ? (
          <div className="customer-auth-shell">
            <div className={`customer-auth-card ${authMode === 'register' ? 'is-register' : 'is-login'}`}>
              {/* Left Brand Hero Panel */}
              <div className="customer-auth-benefits">
                <div>
                  <div className="customer-auth-kicker">
                    <Sparkles size={14} color="var(--amber)" /> RFC CUSTOMER PORTAL
                  </div>
                  <h2 className="customer-auth-title">
                    Account setup for faster ordering.
                  </h2>
                  <p className="customer-auth-copy">
                    Keep your order history and delivery details together in one account dashboard.
                  </p>

                  <div className="customer-auth-benefit-list">
                    {AUTH_BENEFITS.map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <div key={i} className="customer-auth-benefit-item">
                          <div className="customer-auth-benefit-icon">
                            <FIcon size={16} />
                          </div>
                          <div>
                            <strong>{f.title}</strong>
                            <span>{f.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>

              {/* Right Form Panel */}
              <div className="customer-auth-form-panel">
                
                {/* Segmented Control Pill */}
                <div className="customer-auth-segment">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className={`customer-auth-segment-btn ${authMode === 'login' ? 'active' : ''}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    className={`customer-auth-segment-btn ${authMode === 'register' ? 'active' : ''}`}
                  >
                    Create Account
                  </button>
                </div>

                <h3 className="customer-auth-heading">
                  {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
                </h3>
                <p className="customer-auth-subtitle">
                  {authMode === 'login' ? 'Please enter your account details below.' : 'Fill in your details to create your customer account.'}
                </p>

                {authError && (
                  <div className="customer-auth-error">
                    <AlertTriangle size={15} /> {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className={`customer-auth-form ${authMode === 'register' ? 'is-register' : 'is-login'}`}>
                  {authMode === 'register' && (
                    <div>
                      <label className="customer-auth-label">Full Name</label>
                      <div className="input-group"><User size={15} /><input autoComplete="name" placeholder="Your full name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                    </div>
                  )}

                  <div>
                    <label className="customer-auth-label">Email Address</label>
                    <div className="input-group"><Mail size={15} /><input type="email" autoComplete="email" placeholder="you@example.com" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                  </div>

                  <div>
                    <label className="customer-auth-label">Password</label>
                    <div className="input-group" style={{ position: 'relative' }}>
                      <Lock size={15} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        minLength={authMode === 'login' ? 8 : 12}
                        maxLength={128}
                        placeholder={authMode === 'login' ? 'Your password' : '12+ characters with upper, lower and a number'}
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        required
                        style={{ padding: '9px 36px 9px 12px', fontSize: '0.88rem', width: '100%' }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <>
                      <div>
                        <label className="customer-auth-label">Phone Number</label>
                        <div className="input-group"><Phone size={15} /><input autoComplete="tel" placeholder="Your phone number" value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                      </div>
                      <div className="customer-auth-address-grid">
                        <div>
                          <label className="customer-auth-label">Street Address</label>
                          <div className="input-group"><MapPin size={15} /><input autoComplete="street-address" placeholder="Your street address" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                        </div>
                        <div>
                          <label className="customer-auth-label">Postcode</label>
                          <div className="input-group"><MapPin size={15} /><input autoComplete="postal-code" placeholder="Postcode" value={authForm.postcode} onChange={(e) => setAuthForm({ ...authForm, postcode: e.target.value.toUpperCase() })} style={{ padding: '9px 12px', fontSize: '0.88rem' }} /></div>
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.4 }}>
                        <input
                          type="checkbox"
                          checked={authForm.consentAccepted}
                          onChange={(event) => setAuthForm({ ...authForm, consentAccepted: event.target.checked })}
                          required
                          style={{ marginTop: '2px' }}
                        />
                        <span>I consent to the privacy policy and the processing of my account and order details.</span>
                      </label>
                    </>
                  )}

                  <button
                    type="submit"
                    className="btn-submit-modal customer-auth-submit"
                    disabled={isAuthSubmitting}
                  >
                    {isAuthSubmitting ? 'Please wait…' : (authMode === 'login' ? 'Sign In' : 'Create Account')} <ArrowRight size={16} />
                  </button>
                </form>

                <div className="customer-auth-guest">
                  <button
                    type="button"
                    onClick={() => setAuthMode('none')}
                  >
                    <span>Continue as Guest Customer</span>
                    <ArrowRight size={14} />
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
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--green)', color: '#FFF', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 800, marginTop: '2px' }}>
                        <ShieldCheck size={9} /> Signed in
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
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--red)', fontFamily: 'var(--font-head)' }}>{visibleOrders.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '1px solid var(--border)', paddingLeft: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Account</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: isAuthenticated ? 'var(--green)' : 'var(--text2)', fontFamily: 'var(--font-head)' }}>{isAuthenticated ? 'Signed in' : 'Guest'}</span>
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

                  {isAuthenticated && (
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
                  )}
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
                  {activeTab === 'orders' && visibleOrders.length > 0 && (
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text2)', background: 'var(--surface-alt)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                      {visibleOrders.length} recent {visibleOrders.length === 1 ? 'order' : 'orders'} shown
                    </span>
                  )}
                  {activeTab === 'profile' && isAuthenticated && (
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
                )}

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
