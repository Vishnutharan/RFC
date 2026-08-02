import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, ArrowRight, CheckCircle, Minus, Plus, ShoppingBag, Sparkles, Tag, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { validateVoucher } from '../services/api';

const MINIMUM_SPEND = 15.0;
const fallbackThumb = 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=220&auto=format&fit=crop&q=80';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQty,
  onRemoveItem,
  appliedVoucher,
  onApplyVoucher,
  onRemoveVoucher,
  orderMode,
  onProceedToCheckout,
  suggestedItems = [],
  onAddSuggestedItem
}) {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems]
  );
  const isMinSpendMet = subtotal >= MINIMUM_SPEND || orderMode === 'collection';
  const progressPercent = Math.min(100, (subtotal / MINIMUM_SPEND) * 100);
  const discountAmount = appliedVoucher ? (subtotal * appliedVoucher.discountPercent) / 100 : 0;
  const deliveryFee = orderMode === 'delivery' && subtotal < 25 ? 2.5 : 0;
  const total = subtotal - discountAmount + deliveryFee;

  const handleApplyVoucher = () => {
    if (!voucherCode.trim()) return;
    const result = validateVoucher(voucherCode.trim(), subtotal);
    if (result.valid) {
      onApplyVoucher(result);
      setVoucherError('');
      setVoucherCode('');
    } else {
      setVoucherError(result.message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cart-drawer-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Basket"
          >
            <div className="cart-header">
              <h2>
                <ShoppingBag size={21} /> Your Order
                <span className="cat-badge">{cartItems.length}</span>
              </h2>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close basket">
                <X size={18} />
              </button>
            </div>

            <div className="cart-body">
              {cartItems.length === 0 ? (
                <div className="empty-state">
                  <EmptyBasketIllustration />
                  <h3>Your cart is hungry</h3>
                  <p>Add crispy favourites from the menu and checkout in seconds.</p>
                  <a className="hero-primary-action" href="#menu" onClick={onClose}>Browse Menu</a>
                </div>
              ) : (
                <>
                  <div className="delivery-banner">
                    {orderMode === 'delivery' ? 'Delivery - around 25 minutes' : 'Collection - ready in 15 to 20 minutes'}
                  </div>

                  <div className="min-spend-bar">
                    <div className="progress-bg">
                      <div className={`min-spend-progress ${isMinSpendMet ? 'met' : ''}`} style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p>
                      {isMinSpendMet ? (
                        <>
                          <CheckCircle size={15} /> Minimum spend met
                        </>
                      ) : (
                        `Add GBP ${(MINIMUM_SPEND - subtotal).toFixed(2)} more for delivery`
                      )}
                    </p>
                  </div>

                  <div className="cart-items">
                    {cartItems.map((item, index) => {
                      const imageUrl = item.item?.imageUrl || item.imageUrl;
                      return (
                        <div key={item.id || index} className="cart-item-row">
                          {imageUrl ? (
                            <img
                              className="cart-item-thumb"
                              src={imageUrl}
                              alt={item.name}
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.src = fallbackThumb;
                              }}
                            />
                          ) : (
                            <span className="cart-item-thumb-fallback">RFC</span>
                          )}
                          <div className="cart-item-info">
                            <h4>{item.name}</h4>
                            {item.options?.length > 0 && <p className="options">{item.options.join(', ')}</p>}
                            <p className="cart-line-meta">GBP {Number(item.price || 0).toFixed(2)} each</p>
                          </div>
                          <div className="cart-item-actions">
                            <span className="cart-item-price">GBP {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                            <div className="qty-controls">
                              <button className="btn-qty" type="button" onClick={() => onUpdateQty(item.id, item.quantity - 1)}>
                                <Minus size={13} />
                              </button>
                              <span className="qty-val">{item.quantity}</span>
                              <button className="btn-qty" type="button" onClick={() => onUpdateQty(item.id, item.quantity + 1)}>
                                <Plus size={13} />
                              </button>
                            </div>
                            <button className="remove-btn" type="button" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.name}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {suggestedItems.length > 0 && (
                    <section className="complete-meal">
                      <h4>Complete your meal</h4>
                      <div className="addon-rail">
                        {suggestedItems.slice(0, 6).map((item) => (
                          <button key={item.id} className="addon-card" type="button" onClick={() => onAddSuggestedItem?.(item)}>
                            <strong>{item.name}</strong>
                            <span>GBP {Number(item.price || 0).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="voucher-section">
                    {appliedVoucher ? (
                      <div className="applied-voucher-badge">
                        <span><Sparkles size={15} /> {appliedVoucher.code} applied (-{appliedVoucher.discountPercent}%)</span>
                        <button type="button" onClick={onRemoveVoucher} aria-label="Remove voucher">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="voucher-input-group">
                        <Tag size={16} />
                        <input
                          type="text"
                          placeholder="Promo code"
                          value={voucherCode}
                          onChange={(event) => {
                            setVoucherCode(event.target.value.toUpperCase());
                            setVoucherError('');
                          }}
                          onKeyDown={(event) => event.key === 'Enter' && handleApplyVoucher()}
                        />
                        <button className="btn-apply-voucher" type="button" onClick={handleApplyVoucher}>Apply</button>
                      </div>
                    )}
                    {voucherError && (
                      <p className="voucher-error">
                        <AlertCircle size={14} /> {voucherError}
                      </p>
                    )}
                  </div>

                  <div className="cart-summary">
                    <div className="summary-row"><span>Subtotal</span><span>GBP {subtotal.toFixed(2)}</span></div>
                    {appliedVoucher && <div className="summary-row discount"><span>Discount</span><span>-GBP {discountAmount.toFixed(2)}</span></div>}
                    <div className="summary-row">
                      <span>Delivery fee</span>
                      <span>{deliveryFee === 0 ? 'Free' : `GBP ${deliveryFee.toFixed(2)}`}</span>
                    </div>
                    <div className="summary-total"><span>Total</span><span>GBP {total.toFixed(2)}</span></div>
                  </div>
                </>
              )}
            </div>

            <div className="cart-footer">
              <button
                className="btn-checkout"
                type="button"
                disabled={!isMinSpendMet || cartItems.length === 0}
                onClick={onProceedToCheckout}
              >
                Checkout <ArrowRight size={18} />
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyBasketIllustration() {
  return (
    <svg className="hungry-illustration" viewBox="0 0 120 120" role="img" aria-label="Empty basket">
      <defs>
        <linearGradient id="basketGold" x1="0" x2="1">
          <stop offset="0" stopColor="#F4C76B" />
          <stop offset="1" stopColor="#E8A93F" />
        </linearGradient>
      </defs>
      <rect x="22" y="44" width="76" height="52" rx="16" fill="rgba(232,169,63,0.12)" stroke="url(#basketGold)" strokeWidth="4" />
      <path d="M38 46C42 27 78 27 82 46" fill="none" stroke="url(#basketGold)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="48" cy="67" r="4" fill="#E8A93F" />
      <circle cx="72" cy="67" r="4" fill="#E8A93F" />
      <path d="M48 82C56 76 64 76 72 82" fill="none" stroke="#D9534F" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

CartDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.array,
  onUpdateQty: PropTypes.func.isRequired,
  onRemoveItem: PropTypes.func.isRequired,
  appliedVoucher: PropTypes.object,
  onApplyVoucher: PropTypes.func.isRequired,
  onRemoveVoucher: PropTypes.func.isRequired,
  orderMode: PropTypes.oneOf(['delivery', 'collection']).isRequired,
  onProceedToCheckout: PropTypes.func.isRequired,
  suggestedItems: PropTypes.array,
  onAddSuggestedItem: PropTypes.func
};
