import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CATEGORIES } from './data/initialMenu';
import { getMenuItems } from './services/api';
import { useAuth } from './hooks/useAuth';
import { useCart } from './hooks/useCart';
import { useOrders } from './hooks/useOrders';
import './styles/main.css';

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
    let isActive = true;
    setIsLoadingMenu(true);

    getMenuItems()
      .then((items) => {
        if (!isActive) return;
        setMenuItems(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (!isActive) return;
        setMenuItems([]);
        showToast(error.message || 'Menu could not be loaded.', 'error');
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
          <Navigation
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />

          <Banner
            onApplyVoucher={cart.applyVoucher}
            showToast={showToast}
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
                <span className="footer-logo">RFC</span>
                <p>RFC Watford - Fresh Crispy Chicken Since 2018</p>
                <p className="footer-address">119 Courtlands Drive, Watford WD17 4HZ - +44 1923 961864</p>
              </div>
              <div className="footer-links">
                <span>Adults need around 2000 kcal a day</span>
                <a href="https://www.rfcchickenwatford.com/terms" target="_blank" rel="noreferrer">Terms</a>
                <button type="button" className="footer-link-button" onClick={() => setIsPrivacyOpen(true)}>Privacy</button>
              </div>
            </div>
          </footer>
        </>
      )}

      {!isAdminView && !orders.activeOrder && cart.cartCount > 0 && (
        <button className="floating-cart-cta" onClick={() => setIsCartOpen(true)}>
          <span>{cart.cartCount} item{cart.cartCount === 1 ? '' : 's'} in basket</span>
          <strong>GBP {cart.cartSubtotal.toFixed(2)}</strong>
        </button>
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
      <Toast toasts={toasts} />
    </div>
  );
}
