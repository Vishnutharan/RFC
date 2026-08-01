import React, { useState } from 'react';
import { X, ShoppingBag, Plus, Minus, Trash2, Tag, AlertCircle, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { validateVoucher } from '../services/api';

const MINIMUM_SPEND = 15.00;

export default function CartDrawer({ isOpen, onClose, cartItems = [], onUpdateQty, onRemoveItem, appliedVoucher, onApplyVoucher, onRemoveVoucher, orderMode, onProceedToCheckout }) {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isMinSpendMet = subtotal >= MINIMUM_SPEND;
  const progressPercent = Math.min(100, (subtotal / MINIMUM_SPEND) * 100);
  const discountAmount = appliedVoucher ? (subtotal * appliedVoucher.discountPercent / 100) : 0;
  const deliveryFee = orderMode === 'delivery' && subtotal < 25 ? 2.50 : 0;
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

  if (!isOpen) return null;

  return (
    <div className="cart-drawer-overlay" onClick={onClose}>
      <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <h2><ShoppingBag size={20} /> Your Basket ({cartItems.length})</h2>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="empty-state">
              <ShoppingBag className="animated-bag" size={48} strokeWidth={1} />
              <p>Your basket is empty</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text3)', marginTop: '6px' }}>Add items from the menu to get started!</p>
            </div>
          ) : (
            <>
              <div className="delivery-banner">
                {orderMode === 'delivery' ? 'Delivery - 45-55 mins' : 'Collection - Ready in 15-20 mins'}
              </div>

              <div className="min-spend-bar">
                <div className="progress-bg">
                  <div className={`min-spend-progress ${isMinSpendMet ? 'met' : ''}`} style={{ width: `${progressPercent}%` }} />
                </div>
                <p>
                  {isMinSpendMet
                    ? <><CheckCircle size={14} /> Minimum spend met!</>
                    : `Add £${(MINIMUM_SPEND - subtotal).toFixed(2)} more for delivery`}
                </p>
              </div>

              <div className="cart-items">
                {cartItems.map((item, idx) => (
                  <div key={item.id || idx} className="cart-item-row">
                    <div className="cart-item-info">
                      <h4>{item.name}</h4>
                      {item.options && item.options.length > 0 && <p className="options">{item.options.join(', ')}</p>}
                    </div>
                    <div className="cart-item-price">£{(item.price * item.quantity).toFixed(2)}</div>
                    <div className="qty-controls">
                      <button className="btn-qty" onClick={() => onUpdateQty(item.id, item.quantity - 1)}><Minus size={12} /></button>
                      <span className="qty-val">{item.quantity}</span>
                      <button className="btn-qty" onClick={() => onUpdateQty(item.id, item.quantity + 1)}><Plus size={12} /></button>
                    </div>
                    <button className="remove-btn" onClick={() => onRemoveItem(item.id)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>

              <div className="voucher-section">
                {appliedVoucher ? (
                  <div className="applied-voucher-badge">
                    <Sparkles size={14} /> {appliedVoucher.code} applied! (-{appliedVoucher.discountPercent}%)
                    <button onClick={onRemoveVoucher}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="voucher-input-group">
                    <Tag size={16} />
                    <input
                      type="text"
                      placeholder="Enter promo code"
                      value={voucherCode}
                      onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    />
                    <button className="btn-apply-voucher" onClick={handleApplyVoucher}>Apply</button>
                  </div>
                )}
                {voucherError && <p className="voucher-error"><AlertCircle size={13} /> {voucherError}</p>}
              </div>

              <div className="cart-summary">
                <div className="summary-row"><span>Subtotal</span><span>£{subtotal.toFixed(2)}</span></div>
                {appliedVoucher && <div className="summary-row discount"><span>Discount ({appliedVoucher.discountPercent}%)</span><span>-£{discountAmount.toFixed(2)}</span></div>}
                <div className="summary-row"><span>Delivery Fee</span><span>{deliveryFee === 0 ? 'FREE' : `£${deliveryFee.toFixed(2)}`}</span></div>
                <div className="summary-row total"><span>TOTAL</span><span>£{total.toFixed(2)}</span></div>
              </div>
            </>
          )}
        </div>

        <div className="cart-footer">
          <button className="btn-checkout" disabled={!isMinSpendMet || cartItems.length === 0} onClick={onProceedToCheckout}>
            Go to Checkout <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
