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
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            fontFamily: 'var(--font-body)'
          }}
        >
          <motion.aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            aria-label="Basket"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--surface)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--surface)'
            }}>
              <h2 style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1.25rem',
                fontFamily: 'var(--font-head)',
                color: 'var(--text)'
              }}>
                <ShoppingBag size={24} color="var(--red)" /> Your Order
                <span className="cat-badge" style={{ backgroundColor: 'var(--red)', color: 'var(--white)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
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
                  borderRadius: 'var(--radius-full)',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text2)'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              backgroundColor: 'var(--bg)'
            }}>
              {cartItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  color: 'var(--text2)'
                }}>
                  <EmptyBasketIllustration />
                  <h3 style={{ fontFamily: 'var(--font-head)', color: 'var(--text)', marginTop: '24px', marginBottom: '8px' }}>Your cart is hungry</h3>
                  <p style={{ margin: 0, marginBottom: '24px', fontSize: '0.95rem' }}>Add crispy favourites from the menu and checkout in seconds.</p>
                  <button 
                    className="btn-submit-modal" 
                    onClick={onClose}
                    style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius)', border: 'none', backgroundColor: 'var(--red)', color: 'var(--white)', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                    fontSize: '0.9rem',
                    color: 'var(--text2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle size={18} color="var(--green)" />
                    {orderMode === 'delivery' ? 'Delivery - around 25 minutes' : 'Collection - ready in 15 to 20 minutes'}
                  </div>

                  <div style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius)',
                    padding: '16px'
                  }}>
                    <div style={{
                      height: '6px',
                      backgroundColor: 'var(--surface-alt)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                      marginBottom: '12px'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progressPercent}%`, 
                        backgroundColor: isMinSpendMet ? 'var(--green)' : 'var(--amber)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isMinSpendMet ? (
                        <>
                          <CheckCircle size={16} color="var(--green)" /> Minimum spend met
                        </>
                      ) : (
                        `Add GBP ${(MINIMUM_SPEND - subtotal).toFixed(2)} more for delivery`
                      )}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {cartItems.map((item, index) => {
                      const imageUrl = item.item?.imageUrl || item.imageUrl;
                      return (
                        <div key={item.id || index} style={{
                          display: 'flex',
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '16px',
                          gap: '16px',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              loading="lazy"
                              style={{
                                width: '72px',
                                height: '72px',
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-sm)'
                              }}
                              onError={(event) => {
                                event.currentTarget.src = fallbackThumb;
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '72px',
                              height: '72px',
                              backgroundColor: 'var(--surface-alt)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text3)',
                              fontWeight: '600'
                            }}>RFC</div>
                          )}
                          
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <h4 style={{ margin: 0, fontFamily: 'var(--font-head)', color: 'var(--text)', fontSize: '1rem' }}>{item.name}</h4>
                              <button 
                                type="button" 
                                onClick={() => onRemoveItem(item.id)} 
                                aria-label={`Remove ${item.name}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text3)',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            {item.options?.length > 0 && (
                              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text2)' }}>
                                {item.options.join(', ')}
                              </p>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                              <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                                GBP {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                              </span>
                              
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backgroundColor: 'var(--surface-alt)',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-full)'
                              }}>
                                <button 
                                  type="button" 
                                  onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)' }}
                                >
                                  <Minus size={14} />
                                </button>
                                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{item.quantity}</span>
                                <button 
                                  type="button" 
                                  onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text)' }}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {suggestedItems.length > 0 && (
                    <section style={{ marginTop: '8px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontFamily: 'var(--font-head)', color: 'var(--text)' }}>Complete your meal</h4>
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        paddingBottom: '8px',
                        scrollbarWidth: 'none'
                      }}>
                        {suggestedItems.slice(0, 6).map((item) => (
                          <button 
                            key={item.id} 
                            type="button" 
                            className="btn-add-item"
                            onClick={() => onAddSuggestedItem?.(item)}
                            style={{
                              flex: '0 0 auto',
                              width: '140px',
                              backgroundColor: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.name}</strong>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text2)', marginBottom: '8px' }}>GBP {Number(item.price || 0).toFixed(2)}</span>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: 'var(--red)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Plus size={14} /> Add
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <div style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px'
                  }}>
                    {appliedVoucher ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--green)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                          <Sparkles size={16} /> {appliedVoucher.code} applied (-{appliedVoucher.discountPercent}%)
                        </span>
                        <button 
                          type="button" 
                          onClick={onRemoveVoucher} 
                          aria-label="Remove voucher"
                          style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="input-group" style={{ position: 'relative', marginBottom: voucherError ? '8px' : 0 }}>
                          <Tag size={18} color="var(--text3)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                          <input
                            type="text"
                            placeholder="Promo code"
                            value={voucherCode}
                            onChange={(event) => {
                              setVoucherCode(event.target.value.toUpperCase());
                              setVoucherError('');
                            }}
                            onKeyDown={(event) => event.key === 'Enter' && handleApplyVoucher()}
                            style={{
                              width: '100%',
                              padding: '12px 16px 12px 44px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.95rem',
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
                              right: '6px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              backgroundColor: 'var(--text)',
                              color: 'var(--white)',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                        {voucherError && (
                          <p style={{ margin: 0, marginTop: '8px', color: 'var(--red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> {voucherError}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '0.95rem' }}>
                      <span>Subtotal</span>
                      <span>GBP {subtotal.toFixed(2)}</span>
                    </div>
                    {appliedVoucher && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)', fontSize: '0.95rem' }}>
                        <span>Discount</span>
                        <span>-GBP {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '0.95rem' }}>
                      <span>Delivery fee</span>
                      <span>{deliveryFee === 0 ? 'Free' : `GBP ${deliveryFee.toFixed(2)}`}</span>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      color: 'var(--text)', 
                      fontSize: '1.1rem', 
                      fontWeight: '700',
                      paddingTop: '12px',
                      borderTop: '1px dashed var(--border)'
                    }}>
                      <span>Total</span>
                      <span>GBP {total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{
              padding: '24px',
              borderTop: '1px solid var(--border-light)',
              backgroundColor: 'var(--surface)'
            }}>
              <button
                className="btn-submit-modal"
                type="button"
                disabled={!isMinSpendMet || cartItems.length === 0}
                onClick={onProceedToCheckout}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  backgroundColor: 'var(--red)',
                  color: 'var(--white)',
                  fontFamily: 'var(--font-head)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (!isMinSpendMet || cartItems.length === 0) ? 0.6 : 1,
                  cursor: (!isMinSpendMet || cartItems.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-red)'
                }}
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
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Empty basket">
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
