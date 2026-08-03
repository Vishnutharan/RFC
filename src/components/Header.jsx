import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Menu, Search, ShoppingBag, Store, Truck, User, X, Flame } from 'lucide-react';

const navLinks = [
  { label: 'Menu', href: '#menu' },
  { label: 'Deals', href: '#deals' },
  { label: 'Track Order', href: '#track-order' },
  { label: 'Reviews', href: '#reviews' }
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
  const prevCount = useRef(cartCount);

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

  const staffLabel = isAdminView ? 'Storefront' : adminUser ? 'Staff Dashboard' : 'Staff Login';

  return (
    <header className={`header-container ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="announcement-bar">
        <div className="marquee-container">
          <span className="marquee-text">
            Free delivery in our Watford zone - FIRST10 for 10% off - Fresh chicken cooked daily - Direct orders get priority
          </span>
        </div>
        <button className="staff-panel-btn" type="button" onClick={onStaffPanelClick}>
          {staffLabel}
        </button>
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
            <span className="logo-badge">
              <Flame size={24} aria-hidden="true" />
            </span>
            <span>
              <span className="brand-name">RFC</span>
              <span className="brand-subtitle">Watford Kitchen</span>
            </span>
          </button>

          {!isAdminView && (
            <div className="header-center">
              <nav className="header-pill-nav" aria-label="Primary">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href}>{link.label}</a>
                ))}
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
                    <Truck size={16} />
                    <span>Delivery</span>
                  </button>
                  <button
                    className={`mode-btn ${orderMode === 'collection' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setOrderMode('collection')}
                  >
                    <Store size={16} />
                    <span>Collect</span>
                  </button>
                </div>

                <label className="search-container">
                  <Search className="search-icon" size={18} />
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
                  <User size={18} />
                  <span className="account-btn-label">Account</span>
                </button>
              </>
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
            {navLinks.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                className="dashboard-tab"
                style={{ animationDelay: `${index * 55}ms` }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              className="dashboard-tab"
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onStaffPanelClick();
              }}
            >
              {staffLabel}
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
