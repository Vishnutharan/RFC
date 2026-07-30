import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Search, Truck, Store, Flame, User } from 'lucide-react';

const Header = ({ cartCount, orderMode, setOrderMode, searchQuery, setSearchQuery, onOpenCart, onOpenCustomerDashboard, isAdminView, setIsAdminView }) => {
  const [scrolled, setScrolled] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const prevCount = useRef(cartCount);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBouncing(true);
      const t = setTimeout(() => setBouncing(false), 300);
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  return (
    <header className={`header-container ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="announcement-bar">
        <div className="marquee-container">
          <span className="marquee-text">
            🍗 FREE DELIVERY on all orders • Use code FIRST10 for 10% off your first order •
            Fresh Crispy Chicken Daily • Order direct &amp; save! 🔥 •&nbsp;
            🍗 FREE DELIVERY on all orders • Use code FIRST10 for 10% off your first order •
            Fresh Crispy Chicken Daily • Order direct &amp; save! 🔥 •&nbsp;
          </span>
        </div>
        <button className="staff-panel-btn" onClick={() => setIsAdminView(!isAdminView)}>
          {isAdminView ? '← Store Front' : 'Staff Admin Panel'}
        </button>
      </div>

      <div className="header-main">
        <div className="header-content">
          <div className="header-left">
            <div className="brand-container" onClick={() => setIsAdminView(false)}>
              <div className="logo-badge">
                <Flame className="logo-icon" size={24} />
              </div>
              <div>
                <h1 className="brand-name">RFC Watford</h1>
                <span className="brand-subtitle">Fresh Crispy Chicken Since 2018</span>
              </div>
            </div>
          </div>

          {!isAdminView && (
            <div className="header-center">
              <div className="order-mode-toggle">
                <button className={`mode-btn ${orderMode === 'delivery' ? 'active' : ''}`} onClick={() => setOrderMode('delivery')}>
                  <Truck size={16} className="mode-icon" /> <span>Delivery</span>
                </button>
                <button className={`mode-btn ${orderMode === 'collection' ? 'active' : ''}`} onClick={() => setOrderMode('collection')}>
                  <Store size={16} className="mode-icon" /> <span>Collection</span>
                </button>
              </div>
            </div>
          )}

          <div className="header-right">
            {!isAdminView && (
              <>
                <div className="search-container">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button
                  className="mode-btn"
                  onClick={onOpenCustomerDashboard}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 14px' }}
                  title="My Account & Loyalty Rewards"
                >
                  <User size={18} color="var(--red)" />
                  <span className="account-btn-label" style={{ fontSize: '0.85rem' }}>Account</span>
                </button>
              </>
            )}

            <button className="cart-btn" onClick={onOpenCart} title="View Basket">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className={`cart-badge ${bouncing ? 'bounce' : ''}`}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
