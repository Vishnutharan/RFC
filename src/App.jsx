import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, ShoppingBag } from 'lucide-react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Banner from './components/Banner';
import MenuItemCard from './components/MenuItemCard';
import ItemModal from './components/ItemModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import OrderTracker from './components/OrderTracker';
import AdminDashboard from './components/AdminDashboard';
import AdminLoginModal from './components/AdminLoginModal';
import CustomerDashboard from './components/CustomerDashboard';
import PrintReceiptModal from './components/PrintReceiptModal';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import PrivacyPolicy from './components/PrivacyPolicy';
import { CATEGORIES, MENU_ITEMS } from './data/initialMenu';
import { getMenuItems, getOrder } from './services/api';
import { useAuth } from './hooks/useAuth';
import { useCart } from './hooks/useCart';
import { useOrders } from './hooks/useOrders';
import { ThemeProvider } from './hooks/useTheme';

export default function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderMode, setOrderMode] = useState('delivery');
  const [isAdminView, setIsAdminView] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);

  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isCustomerDashboardOpen, setIsCustomerDashboardOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [printReceiptOrder, setPrintReceiptOrder] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const { adminUser, setAdminUser } = useAuth();
  const cart = useCart(showToast);
  const orders = useOrders(showToast);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/track\/([^/]+)/);
    if (!match) return undefined;

    let isActive = true;
    const accessToken = new URLSearchParams(window.location.search).get('accessToken') || undefined;
    getOrder(decodeURIComponent(match[1]), accessToken)
      .then((trackedOrder) => {
        if (!isActive) return;
        orders.setActiveOrder({
          ...(trackedOrder || {}),
          accessToken: trackedOrder?.accessToken || accessToken
        });
      })
      .catch((error) => {
        if (isActive) showToast(error.message || 'Could not open this tracking link.', 'error');
      });

    return () => {
      isActive = false;
    };
  }, [orders.setActiveOrder, showToast]);

  useEffect(() => {
    let isActive = true;
    setIsLoadingMenu(true);

    getMenuItems()
      .then((items) => {
        if (!isActive) return;
        setMenuItems(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (!isActive) return;
        setMenuItems(MENU_ITEMS);
        showToast(error.message || 'Using the offline menu while the database is unavailable.', 'warning');
      })
      .finally(() => {
        if (isActive) setIsLoadingMenu(false);
      });

    return () => {
      isActive = false;
    };
  }, [showToast]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory;
      const matchesSearch = !query ||
        item.name?.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, menuItems, searchQuery]);

  const suggestedAddOns = useMemo(() => (
    menuItems
      .filter((item) => ['sides', 'desserts-drinks'].includes(item.categoryId))
      .slice(0, 6)
  ), [menuItems]);

  const handleStaffPanelClick = useCallback(() => {
    if (isAdminView) {
      setIsAdminView(false);
      return;
    }

    if (adminUser) {
      setIsAdminView(true);
      return;
    }

    setIsAdminLoginOpen(true);
  }, [adminUser, isAdminView]);

  const handleSelectItem = useCallback((item) => {
    if (item.hasOptions) {
      setSelectedItemForModal(item);
      return;
    }

    cart.addMenuItem(item);
  }, [cart]);

  const handleAddToCart = useCallback((cartPayload) => {
    cart.addCustomizedItem(cartPayload);
    setSelectedItemForModal(null);
  }, [cart]);

  const handleReorder = useCallback((pastOrder) => {
    if (!cart.reorder(pastOrder)) return;
    setIsCustomerDashboardOpen(false);
    setIsCartOpen(true);
  }, [cart]);

  const handleCancelOrder = useCallback(async (orderIdOrNumber, cancellationReason) => {
    try {
      await orders.cancelExistingOrder(orderIdOrNumber, cancellationReason);
    } catch (error) {
      showToast(error.message || 'Could not cancel order online. Please call the store.', 'error');
    }
  }, [orders, showToast]);

  const handleOrderSuccess = useCallback(async (orderPayload) => {
    const savedOrder = await orders.submitOrder(orderPayload);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    cart.clearCart();
    return savedOrder;
  }, [cart, orders]);

  return (
    <ThemeProvider>
      <div className="app-container">
      <Header
        cartCount={cart.cartCount}
        orderMode={orderMode}
        setOrderMode={setOrderMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenCustomerDashboard={() => setIsCustomerDashboardOpen(true)}
        isAdminView={isAdminView}
        adminUser={adminUser}
        onStaffPanelClick={handleStaffPanelClick}
      />

      {isAdminView && adminUser ? (
        <ErrorBoundary title="Staff dashboard failed">
          <AdminDashboard showToast={showToast} adminUser={adminUser} onExit={() => setIsAdminView(false)} />
        </ErrorBoundary>
      ) : orders.activeOrder ? (
        <ErrorBoundary title="Order tracker failed">
          <OrderTracker
            order={orders.activeOrder}
            onNewOrder={() => orders.setActiveOrder(null)}
            onCancelOrder={handleCancelOrder}
            showToast={showToast}
          />
        </ErrorBoundary>
      ) : (
        <>
          <Banner
            onApplyVoucher={cart.applyVoucher}
            showToast={showToast}
          />

          <Navigation
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />

          <main id="menu" className="menu-main-container">
            <div className="section-header">
              <h2>
                {activeCategory === 'all'
                  ? 'Full RFC Menu'
                  : CATEGORIES.find((category) => category.id === activeCategory)?.name || 'Menu'}
              </h2>
              <span className="item-count">{filteredItems.length} items available</span>
            </div>

            {isLoadingMenu ? (
              <div className="menu-grid">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="skeleton-card">
                    <div className="skeleton skeleton-img" />
                    <div className="skeleton skeleton-text" />
                    <div className="skeleton skeleton-text short" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-menu-state">
                <h3>No menu items found</h3>
                <p>Try another category, search term, or check that the database has seeded menu data.</p>
              </div>
            ) : (
              <ErrorBoundary title="Menu failed">
                <div className="menu-grid">
                  {filteredItems.map((item, index) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      index={index}
                      onSelectItem={handleSelectItem}
                    />
                  ))}
                </div>
              </ErrorBoundary>
            )}
          </main>

          <footer className="app-footer">
            <div className="footer-content">
              <div className="footer-brand">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="logo-badge" style={{ width: 32, height: 32 }}>
                    <Flame size={18} />
                  </span>
                  <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text)' }}>
                    RFC <span style={{ color: 'var(--red)' }}>Watford</span>
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text2)' }}>Fresh Crispy Chicken &amp; Box Meals Since 2018</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text3)' }}>119 Courtlands Drive, Watford WD17 4HZ &bull; +44 1923 961864</p>
              </div>

              <div className="footer-links">
                <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>🔥 Adults need around 2000 kcal a day</span>
                <span style={{ color: 'var(--border)' }}>&bull;</span>
                <a href="https://www.rfcchickenwatford.com/terms" target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 600, textDecoration: 'none' }}>Terms &amp; Conditions</a>
                <span style={{ color: 'var(--border)' }}>&bull;</span>
                <button type="button" className="footer-link-button" onClick={() => setIsPrivacyOpen(true)} style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
              </div>
            </div>
            <div style={{ maxWidth: '1320px', margin: '16px auto 0', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text3)' }}>
              &copy; {new Date().getFullYear()} RFC Watford Kitchen. All rights reserved. Prepared fresh to order.
            </div>
          </footer>
        </>
      )}

      {!isAdminView && !orders.activeOrder && cart.cartCount > 0 && (
        <motion.button 
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="floating-cart-cta" 
          onClick={() => setIsCartOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} />
            <span>{cart.cartCount} {cart.cartCount === 1 ? 'item' : 'items'} in basket</span>
          </div>
          <strong style={{ fontFamily: 'var(--font-head)', fontSize: '1rem', background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: 'var(--radius-full)' }}>
            £{cart.cartSubtotal.toFixed(2)}
          </strong>
        </motion.button>
      )}

      <ItemModal
        item={selectedItemForModal}
        onClose={() => setSelectedItemForModal(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart.cartItems}
        onUpdateQty={cart.updateQuantity}
        onRemoveItem={cart.removeItem}
        appliedVoucher={cart.appliedVoucher}
        onApplyVoucher={cart.applyVoucher}
        onRemoveVoucher={cart.removeVoucher}
        orderMode={orderMode}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        suggestedItems={suggestedAddOns}
        onAddSuggestedItem={cart.addMenuItem}
      />

      <ErrorBoundary title="Checkout failed">
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cartItems={cart.cartItems}
          orderMode={orderMode}
          appliedVoucher={cart.appliedVoucher}
          onOrderSuccess={handleOrderSuccess}
        />
      </ErrorBoundary>

      <CustomerDashboard
        isOpen={isCustomerDashboardOpen}
        onClose={() => setIsCustomerDashboardOpen(false)}
        orders={orders.userOrders}
        onReorder={handleReorder}
        onPrintReceipt={(order) => setPrintReceiptOrder(order)}
        onCancelOrder={handleCancelOrder}
        showToast={showToast}
      />

      <PrintReceiptModal
        isOpen={Boolean(printReceiptOrder)}
        onClose={() => setPrintReceiptOrder(null)}
        order={printReceiptOrder}
      />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={(user) => {
          setAdminUser(user);
          setIsAdminLoginOpen(false);
          setIsAdminView(true);
          showToast('Staff login successful.');
        }}
      />

      <PrivacyPolicy isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <Toast
        toasts={toasts}
        dismissToast={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      />
      </div>
    </ThemeProvider>
  );
}
