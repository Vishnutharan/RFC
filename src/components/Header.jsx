import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Menu, Search, ShoppingBag, Store, Truck, User, X, ShieldCheck, UtensilsCrossed, Tag, Clock, Star } from 'lucide-react';

const navLinks = [
  { label: 'Menu', href: '#menu', icon: UtensilsCrossed },
  { label: 'Deals', href: '#deals', icon: Tag },
  { label: 'Track Order', href: '#track-order', icon: Clock },
  { label: 'Reviews', href: '#reviews', icon: Star }
];

export default function Header({
  cartCount,
  orderMode,
  setOrderMode,
  searchQuery,
  setSearchQuery,
  onOpenCart,
  onOpenCustomerDashboard,
  isAdminView,
  adminUser,
  onStaffPanelClick
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const headerRef = useRef(null);
  const prevCount = useRef(cartCount);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    const syncHeaderHeight = () => {
      document.documentElement.style.setProperty('--site-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };

    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncHeaderHeight);
    resizeObserver?.observe(header);

    return () => {
      window.removeEventListener('resize', syncHeaderHeight);
      resizeObserver?.disconnect();
      document.documentElement.style.removeProperty('--site-header-height');
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 360);
      prevCount.current = cartCount;
      return () => clearTimeout(timer);
    }

    prevCount.current = cartCount;
    return undefined;
  }, [cartCount]);

  const adminLabel = isAdminView ? 'Back to Store' : adminUser ? 'Admin Dashboard' : 'Admin Login';

  return (
    <header ref={headerRef} className={`header-container ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="announcement-bar">
        <div className="marquee-container">
          <span className="marquee-text">
            🔥 FAST & FREE DELIVERY IN WATFORD &bull; 📞 ORDER DIRECT: 01923 677407 &bull; USE &apos;FIRST10&apos; FOR 10% OFF &bull; Uber Eats & Just Eat Available
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="tel:01923677407"
            className="staff-panel-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: 'rgba(255,255,255,0.25)' }}
          >
            📞 01923 677407
          </a>
          <button className="staff-panel-btn" type="button" onClick={onStaffPanelClick}>
            <ShieldCheck size={14} style={{ marginRight: 4 }} />
            {adminLabel}
          </button>
        </div>
      </div>

      <div className="header-main">
        <div className="header-content">
          <button
            className="mobile-menu-toggle icon-button"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          <button className="brand-container" type="button" onClick={() => isAdminView && onStaffPanelClick()}>
            <div className="logo-badge" style={{ padding: '2px', background: 'var(--red)', overflow: 'hidden' }}>
              <img
                src="/assets/rfc.png"
                alt="RFC Watford Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xs)' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <span>
              <span className="brand-name">RFC</span>
              <span className="brand-subtitle">Chicken &bull; Peri Peri &bull; Burgers</span>
            </span>
          </button>

          {!isAdminView && (
            <div className="header-center">
              <nav className="header-pill-nav" aria-label="Primary">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a key={link.href} href={link.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Icon size={14} color="var(--red)" />
                      <span>{link.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          )}

          <div className="header-right">
            {!isAdminView && (
              <>
                <div className="order-mode-toggle" aria-label="Order mode">
                  <button
                    className={`mode-btn ${orderMode === 'delivery' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setOrderMode('delivery')}
                  >
                    <Truck size={15} />
                    <span>Delivery</span>
                  </button>
                  <button
                    className={`mode-btn ${orderMode === 'collection' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setOrderMode('collection')}
                  >
                    <Store size={15} />
                    <span>Collect</span>
                  </button>
                </div>

                <label className="search-container">
                  <Search className="search-icon" size={17} />
                  <span className="sr-only">Search menu</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>

                <button
                  className="account-btn"
                  type="button"
                  onClick={onOpenCustomerDashboard}
                  aria-label="Open account"
                >
                  <User size={17} />
                  <span className="account-btn-label">Account</span>
                </button>

                <button
                  className="account-btn"
                  type="button"
                  onClick={onStaffPanelClick}
                  style={{ background: 'var(--red-light)', color: 'var(--red)', borderColor: 'var(--red-glow)', fontWeight: 800 }}
                >
                  <ShieldCheck size={17} />
                  <span className="account-btn-label">{adminLabel}</span>
                </button>
              </>
            )}

            {isAdminView && (
              <button
                className="btn-submit-modal"
                type="button"
                onClick={onStaffPanelClick}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Exit Admin Mode
              </button>
            )}

            <button className="cart-btn" type="button" onClick={onOpenCart} aria-label="Open basket">
              <ShoppingBag size={21} />
              {cartCount > 0 && (
                <span className={`cart-badge ${bouncing ? 'bounce' : ''}`}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-menu-panel glass-panel">
          <div className="modal-header">
            <strong className="brand-name">RFC</strong>
            <button className="close-btn" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>
          <nav className="modal-body">
            {navLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="dashboard-tab"
                  style={{ animationDelay: `${index * 55}ms`, display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={16} color="var(--red)" />
                  <span>{link.label}</span>
                </a>
              );
            })}
            <button
              className="dashboard-tab"
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onStaffPanelClick();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ShieldCheck size={16} color="var(--red)" />
              <span>{adminLabel}</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

Header.propTypes = {
  cartCount: PropTypes.number.isRequired,
  orderMode: PropTypes.oneOf(['delivery', 'collection']).isRequired,
  setOrderMode: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
  onOpenCart: PropTypes.func.isRequired,
  onOpenCustomerDashboard: PropTypes.func.isRequired,
  isAdminView: PropTypes.bool.isRequired,
  adminUser: PropTypes.object,
  onStaffPanelClick: PropTypes.func.isRequired
};
