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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            justify: 'flex-end',
            fontFamily: 'var(--font-body)'
          }}
        >
          <motion.aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            aria-label="Basket"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--surface)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Drawer Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFF',
              flexShrink: 0
            }}>
              <h2 style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1.15rem',
                fontFamily: 'var(--font-head)',
                color: 'var(--text)'
              }}>
                <ShoppingBag size={22} color="var(--red)" /> Your Order
                <span className="cat-badge" style={{ backgroundColor: 'var(--red)', color: '#FFF', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 800 }}>
                  {cartItems.length}
                </span>
              </h2>
              <button 
                type="button" 
                onClick={onClose} 
                aria-label="Close basket"
                style={{
                  background: 'var(--surface-alt)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text2)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: 'var(--bg)'
            }}>
              {cartItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: 'var(--text2)'
                }}>
                  <EmptyBasketIllustration />
                  <h3 style={{ fontFamily: 'var(--font-head)', color: 'var(--text)', marginTop: '20px', marginBottom: '6px' }}>Your basket is empty</h3>
                  <p style={{ margin: 0, marginBottom: '20px', fontSize: '0.88rem' }}>Add crispy favourites from the menu and checkout in seconds.</p>
                  <button 
                    className="btn-submit-modal" 
                    onClick={onClose}
                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--red)', color: '#FFF', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  {/* Fulfillment mode info */}
                  <div style={{
                    backgroundColor: '#FFF',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: 'var(--text2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle size={16} color="var(--green)" />
                    {orderMode === 'delivery' ? 'Delivery - around 25 minutes' : 'Collection - ready in 15 to 20 minutes'}
                  </div>

                  {/* Minimum spend progress */}
                  <div style={{
                    backgroundColor: '#FFF',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px'
                  }}>
                    <div style={{
                      height: '5px',
                      backgroundColor: 'var(--surface-alt)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                      marginBottom: '8px'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progressPercent}%`, 
                        backgroundColor: isMinSpendMet ? 'var(--green)' : 'var(--amber)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      {isMinSpendMet ? (
                        <>
                          <CheckCircle size={14} color="var(--green)" /> Minimum spend met
                        </>
                      ) : (
                        `Add £${(MINIMUM_SPEND - subtotal).toFixed(2)} more for delivery`
                      )}
                    </p>
                  </div>

                  {/* Cart Item Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cartItems.map((item, index) => {
                      const imageUrl = item.item?.imageUrl || item.imageUrl;
                      return (
                        <div key={item.id || index} style={{
                          display: 'flex',
                          backgroundColor: '#FFF',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          gap: '12px',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              loading="lazy"
                              style={{
                                width: '56px',
                                height: '56px',
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-xs)'
                              }}
                              onError={(event) => {
                                event.currentTarget.src = fallbackThumb;
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '56px',
                              height: '56px',
                              backgroundColor: 'var(--surface-alt)',
                              borderRadius: 'var(--radius-xs)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text3)',
                              fontWeight: '700',
                              fontSize: '0.8rem'
                            }}>RFC</div>
                          )}
                          
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h4 style={{ margin: 0, fontFamily: 'var(--font-head)', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 800 }}>{item.name}</h4>
                              <button 
                                type="button" 
                                onClick={() => onRemoveItem(item.id)} 
                                aria-label={`Remove ${item.name}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text3)',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                            
                            {item.options?.length > 0 && (
                              <p style={{ margin: '2px 0 6px 0', fontSize: '0.75rem', color: 'var(--text3)' }}>
                                {item.options.join(', ')}
                              </p>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '800', color: 'var(--red)', fontSize: '0.88rem' }}>
                                £{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                              </span>
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                backgroundColor: 'var(--surface-alt)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--border)'
                              }}>
                                <button 
                                  type="button" 
                                  onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)', padding: 2 }}
                                >
                                  <Minus size={13} />
                                </button>
                                <span style={{ fontSize: '0.82rem', fontWeight: '800' }}>{item.quantity}</span>
                                <button 
                                  type="button" 
                                  onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)', padding: 2 }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Suggested Add-ons */}
                  {suggestedItems.length > 0 && (
                    <section style={{ marginTop: '4px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-head)', color: 'var(--text)', fontSize: '0.88rem', fontWeight: 800 }}>Complete your meal</h4>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        scrollbarWidth: 'none'
                      }}>
                        {suggestedItems.slice(0, 6).map((item) => (
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            key={item.id} 
                            type="button" 
                            className="btn-add-item"
                            onClick={() => onAddSuggestedItem?.(item)}
                            style={{
                              flex: '0 0 auto',
                              width: '120px',
                              backgroundColor: '#FFF',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <strong style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.name}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '4px' }}>£{Number(item.price || 0).toFixed(2)}</span>
                            <div style={{ marginTop: 'auto', fontSize: '0.78rem', color: 'var(--red)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Plus size={12} /> Add
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Promo Voucher Code */}
                  <div style={{
                    backgroundColor: '#FFF',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px'
                  }}>
                    {appliedVoucher ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        backgroundColor: '#ECFDF5',
                        color: 'var(--green)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-xs)'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '0.82rem' }}>
                          <Sparkles size={14} /> {appliedVoucher.code} applied (-{appliedVoucher.discountPercent}%)
                        </span>
                        <button 
                          type="button" 
                          onClick={onRemoveVoucher} 
                          aria-label="Remove voucher"
                          style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Tag size={15} color="var(--text3)" style={{ position: 'absolute', left: '10px' }} />
                          <input
                            type="text"
                            placeholder="Promo code (e.g. OVER25)"
                            value={voucherCode}
                            onChange={(event) => {
                              setVoucherCode(event.target.value.toUpperCase());
                              setVoucherError('');
                            }}
                            onKeyDown={(event) => event.key === 'Enter' && handleApplyVoucher()}
                            style={{
                              width: '100%',
                              padding: '8px 65px 8px 32px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.82rem',
                              fontFamily: 'var(--font-body)',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button 
                            type="button" 
                            onClick={handleApplyVoucher}
                            style={{
                              position: 'absolute',
                              right: '4px',
                              backgroundColor: 'var(--text)',
                              color: '#FFF',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                        {voucherError && (
                          <p style={{ margin: '4px 0 0 0', color: 'var(--red)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <AlertCircle size={13} /> {voucherError}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Price Summary Breakdown */}
                  <div style={{
                    backgroundColor: '#FFF',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '0.82rem' }}>
                      <span>Subtotal</span>
                      <span>£{subtotal.toFixed(2)}</span>
                    </div>
                    {appliedVoucher && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)', fontSize: '0.82rem', fontWeight: 700 }}>
                        <span>Discount</span>
                        <span>-£{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '0.82rem' }}>
                      <span>Delivery Fee</span>
                      <span>{deliveryFee === 0 ? <span style={{ color: 'var(--green)', fontWeight: 800 }}>FREE</span> : `£${deliveryFee.toFixed(2)}`}</span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      color: 'var(--text)', 
                      fontSize: '1rem', 
                      fontWeight: '900',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--border)'
                    }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--red)' }}>£{total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* PINNED STICKY FOOTER CHECKOUT ACTION BAR */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border)',
              backgroundColor: '#FFF',
              flexShrink: 0,
              zIndex: 20,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.06)'
            }}>
              <motion.button
                whileHover={{ scale: isMinSpendMet && cartItems.length > 0 ? 1.02 : 1 }}
                whileTap={{ scale: isMinSpendMet && cartItems.length > 0 ? 0.97 : 1 }}
                className="btn-submit-modal"
                type="button"
                disabled={!isMinSpendMet || cartItems.length === 0}
                onClick={onProceedToCheckout}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: (!isMinSpendMet || cartItems.length === 0) ? 'var(--text3)' : 'linear-gradient(135deg, var(--red), #DC2626)',
                  color: '#FFF',
                  fontFamily: 'var(--font-head)',
                  fontSize: '1.05rem',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: (!isMinSpendMet || cartItems.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: (!isMinSpendMet || cartItems.length === 0) ? 'none' : '0 8px 20px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                Checkout • £{total.toFixed(2)} <ArrowRight size={18} />
              </motion.button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyBasketIllustration() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width="100" height="100" viewBox="0 0 120 120" role="img" aria-label="Empty basket">
        <defs>
          <linearGradient id="basketRed" x1="0" x2="1">
            <stop offset="0" stopColor="var(--red)" />
            <stop offset="1" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
        <rect x="22" y="44" width="76" height="52" rx="16" fill="rgba(229,41,41,0.08)" stroke="url(#basketRed)" strokeWidth="4" />
        <path d="M38 46C42 27 78 27 82 46" fill="none" stroke="url(#basketRed)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="48" cy="67" r="4" fill="var(--red)" />
        <circle cx="72" cy="67" r="4" fill="var(--red)" />
        <path d="M48 82C56 76 64 76 72 82" fill="none" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
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
