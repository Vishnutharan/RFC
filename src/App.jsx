import React, { useState, useEffect, useCallback } from 'react';
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

import { MENU_ITEMS, CATEGORIES } from './data/initialMenu';
import { cancelOrder, getCurrentSession, getMenuItems, validateVoucher, placeOrder } from './services/api';
import './styles/main.css';

export default function App() {
  // Navigation & Search State
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderMode, setOrderMode] = useState('delivery');
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  // Data state
  const [menuItems, setMenuItems] = useState(MENU_ITEMS);
  const [userOrders, setUserOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cart State
  const [cartItems, setCartItems] = useState([]);
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  // UI Modals
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isCustomerDashboardOpen, setIsCustomerDashboardOpen] = useState(false);
  const [printReceiptOrder, setPrintReceiptOrder] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  // Load menu and user order history on mount
  useEffect(() => {
    setIsLoading(true);
    getMenuItems().then(items => {
      if (items && items.length > 0) setMenuItems(items);
      setIsLoading(false);
    });

    getCurrentSession()
      .then(session => {
        if (session?.role === 'staff' || session?.role === 'manager') {
          setAdminUser(session);
        }
      })
      .catch(() => {});

    try {
      const recent = JSON.parse(localStorage.getItem('rfc_recent_orders') || '[]');
      setUserOrders(Array.isArray(recent) ? recent : []);
    } catch {
      setUserOrders([]);
    }
  }, []);

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

  // Handle item selection
  const handleSelectItem = useCallback((item) => {
    if (item.hasOptions) {
      setSelectedItemForModal(item);
    } else {
      const cartEntry = {
        id: `${item.id}-${Date.now()}`,
        name: item.name,
        price: item.price,
        unitPrice: item.price,
        quantity: 1,
        options: [],
        selectedSide: '',
        selectedDrink: '',
        item: item
      };
      setCartItems(prev => [...prev, cartEntry]);
      showToast(`Added ${item.name} to basket!`);
    }
  }, [showToast]);

  // Handle add-to-cart from customization modal
  const handleAddToCart = useCallback((cartPayload) => {
    const options = [];
    if (cartPayload.selectedSide) options.push(cartPayload.selectedSide);
    if (cartPayload.selectedDrink) options.push(cartPayload.selectedDrink);

    const cartEntry = {
      id: `${cartPayload.item.id}-${Date.now()}`,
      name: cartPayload.item.name,
      price: cartPayload.unitPrice,
      unitPrice: cartPayload.unitPrice,
      quantity: cartPayload.quantity,
      options: options,
      selectedSide: cartPayload.selectedSide,
      selectedDrink: cartPayload.selectedDrink,
      item: cartPayload.item
    };

    setCartItems(prev => [...prev, cartEntry]);
    showToast(`Added ${cartPayload.item.name} to basket!`);
  }, [showToast]);

  // 1-Click Reorder
  const handleReorder = useCallback((pastOrder) => {
    if (!pastOrder.items || pastOrder.items.length === 0) return;
    setCartItems(pastOrder.items);
    setIsCustomerDashboardOpen(false);
    setIsCartOpen(true);
    showToast('Reordered past items into your basket! 🛒');
  }, [showToast]);

  // Order Cancellation Handler
  const handleCancelOrder = useCallback(async (orderIdOrNumber, cancellationReason) => {
    setUserOrders(prev => prev.map(o => {
      if (o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber) {
        return { ...o, orderStatus: 'Cancelled', cancellationReason };
      }
      return o;
    }));

    if (activeOrder && (activeOrder.id === orderIdOrNumber || activeOrder.orderNumber === orderIdOrNumber)) {
      setActiveOrder(prev => ({ ...prev, orderStatus: 'Cancelled', cancellationReason }));
    }

    try {
      await cancelOrder(orderIdOrNumber, cancellationReason);
      showToast('Order cancelled successfully.', 'info');
    } catch (error) {
      showToast(error.message || 'Could not cancel order online. Please call the store.', 'error');
    }
  }, [activeOrder, showToast]);

  // Cart quantity update
  const handleUpdateQty = useCallback((idOrIndex, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(idOrIndex);
      return;
    }
    setCartItems(prev =>
      prev.map((item, idx) => {
        if (item.id === idOrIndex || idx === idOrIndex) {
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  }, []);

  // Remove cart item
  const handleRemoveItem = useCallback((idOrIndex) => {
    setCartItems(prev => prev.filter((item, idx) => item.id !== idOrIndex && idx !== idOrIndex));
    showToast('Item removed from basket', 'info');
  }, [showToast]);

  // Voucher handling
  const handleApplyVoucher = useCallback((codeOrResult) => {
    if (typeof codeOrResult === 'string') {
      const subtotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const result = validateVoucher(codeOrResult, subtotal);
      if (result.valid) {
        setAppliedVoucher(result);
        showToast(`Voucher ${result.code} applied! ${result.discountPercent}% off`);
      }
      return result;
    }
    if (codeOrResult && codeOrResult.valid) {
      setAppliedVoucher(codeOrResult);
      showToast(`Voucher ${codeOrResult.code} applied! ${codeOrResult.discountPercent}% off`);
    }
    return codeOrResult;
  }, [cartItems, showToast]);

  const handleRemoveVoucher = useCallback(() => {
    setAppliedVoucher(null);
    showToast('Voucher removed', 'info');
  }, [showToast]);

  // Checkout flow
  const handleProceedToCheckout = useCallback(() => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, []);

  // Order placement
  const handleOrderSuccess = useCallback(async (orderPayload) => {
    const subtotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discountAmount = appliedVoucher ? (subtotal * appliedVoucher.discountPercent / 100) : 0;
    const total = subtotal - discountAmount;
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-GB');

    const payload = orderPayload || {
      orderType: orderMode,
      customerName: 'Customer',
      customerPhone: '+44 7000 000000',
      customerEmail: 'customer@rfc.com',
      deliveryAddress: orderMode === 'delivery' ? '37 Berry Avenue' : 'Store Collection',
      deliveryPostcode: 'WD24 6RU',
      items: cartItems,
      subtotal,
      discountAmount,
      deliveryFee: 0,
      total,
      voucherCode: appliedVoucher?.code || null,
      paymentMethod: 'card',
      orderTime: formattedTimestamp,
      createdAt: now.toISOString()
    };

    try {
      const savedOrder = await placeOrder(payload);
      setIsCheckoutOpen(false);
      setCartItems([]);
      setAppliedVoucher(null);
      setActiveOrder(savedOrder);
      setUserOrders(prev => {
        const next = [savedOrder, ...prev].slice(0, 20);
        localStorage.setItem('rfc_recent_orders', JSON.stringify(next));
        return next;
      });
      showToast(`Order #${savedOrder.orderNumber} placed successfully!`);
    } catch (error) {
      showToast(error.message || 'Order could not be placed. Please try again.', 'error');
    }
  }, [cartItems, appliedVoucher, orderMode, showToast]);

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory;
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        cartCount={cartCount}
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

      {/* View Switcher */}
      {isAdminView && adminUser ? (
        <AdminDashboard showToast={showToast} adminUser={adminUser} onExit={() => setIsAdminView(false)} />
      ) : activeOrder ? (
        <OrderTracker
          order={activeOrder}
          onNewOrder={() => setActiveOrder(null)}
          onCancelOrder={handleCancelOrder}
        />
      ) : (
        <>
          {/* Sticky Category Tabs */}
          <Navigation
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />

          {/* Hero & Promotional Banner */}
          <Banner
            onApplyVoucher={handleApplyVoucher}
            showToast={showToast}
          />

          {/* Main Menu Grid */}
          <main id="menu" className="menu-main-container">
            <div className="section-header">
              <h2>
                {activeCategory === 'all'
                  ? 'Full RFC Menu'
                  : CATEGORIES.find(c => c.id === activeCategory)?.name || 'Menu'}
              </h2>
              <span className="item-count">
                {filteredItems.length} items available
              </span>
            </div>

            {isLoading ? (
              <div className="menu-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton skeleton-img"></div>
                    <div className="skeleton skeleton-text"></div>
                    <div className="skeleton skeleton-text short"></div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-menu-state">
                <h3>No menu items found</h3>
                <p>Try searching for something else or pick a different category.</p>
              </div>
            ) : (
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
            )}
          </main>

          {/* Footer */}
          <footer className="app-footer">
            <div className="footer-content">
              <div className="footer-brand">
                <span className="footer-logo">RFC</span>
                <p>RFC Watford — Fresh Crispy Chicken Since 2018</p>
                <p className="footer-address">119 Courtlands Drive, Watford WD17 4HZ • +44 1923 961864</p>
              </div>
              <div className="footer-links">
                <span>Adults need around 2000 kcal a day</span>
                <a href="https://www.rfcchickenwatford.com/terms" target="_blank" rel="noreferrer">Terms</a>
                <a href="https://www.rfcchickenwatford.com/privacy" target="_blank" rel="noreferrer">Privacy</a>
              </div>
            </div>
          </footer>
        </>
      )}

      {!isAdminView && !activeOrder && cartCount > 0 && (
        <button className="floating-cart-cta" onClick={() => setIsCartOpen(true)}>
          <span>{cartCount} item{cartCount === 1 ? '' : 's'} in basket</span>
          <strong>£{cartSubtotal.toFixed(2)}</strong>
        </button>
      )}

      {/* Item Customization Modal */}
      <ItemModal
        item={selectedItemForModal}
        onClose={() => setSelectedItemForModal(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        appliedVoucher={appliedVoucher}
        onApplyVoucher={handleApplyVoucher}
        onRemoveVoucher={handleRemoveVoucher}
        orderMode={orderMode}
        onProceedToCheckout={handleProceedToCheckout}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        orderMode={orderMode}
        appliedVoucher={appliedVoucher}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Customer Account & Loyalty Portal */}
      <CustomerDashboard
        isOpen={isCustomerDashboardOpen}
        onClose={() => setIsCustomerDashboardOpen(false)}
        orders={userOrders}
        onReorder={handleReorder}
        onPrintReceipt={(ord) => setPrintReceiptOrder(ord)}
        onCancelOrder={handleCancelOrder}
        showToast={showToast}
      />

      {/* Print Receipt Modal */}
      <PrintReceiptModal
        isOpen={!!printReceiptOrder}
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

      {/* Toast Notifications */}
      <Toast toasts={toasts} />
    </div>
  );
}
