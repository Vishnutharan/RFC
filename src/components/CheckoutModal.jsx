import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { X, CreditCard, Lock, User, Mail, Phone, MapPin, Truck, Store, Banknote, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { checkDeliveryEligibility } from '../utils/deliveryRadius';
import { getCurrentUser } from '../services/customerAuth';

export default function CheckoutModal({ isOpen, onClose, cartItems = [], orderMode, appliedVoucher, onOrderSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    address: '', postcode: '', notes: '',
    paymentMethod: 'card'
  });
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '' });

  // Auto-prefill customer info from logged in profile on mount / open
  useEffect(() => {
    if (isOpen) {
      const user = getCurrentUser();
      if (user) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || user.name || '',
          email: prev.email || user.email || '',
          phone: prev.phone || user.phone || '',
          address: prev.address || user.address || '37 Berry Avenue',
          postcode: prev.postcode || user.postcode || 'WD24 6RU'
        }));
      }
    }
  }, [isOpen]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCardChange = (e) => {
    let { name, value } = e.target;
    if (name === 'number') value = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    if (name === 'expiry') value = value.replace(/\D/g, '').replace(/(.{2})/, '$1/').slice(0, 5);
    if (name === 'cvv') value = value.replace(/\D/g, '').slice(0, 3);
    setCardData({ ...cardData, [name]: value });
  };

  // 5 km Delivery Radius Eligibility Check
  const radiusCheck = useMemo(() => {
    if (orderMode === 'collection') return { isEligible: true, distanceKm: 0, reason: '🏪 Store Collection — 119 Courtlands Drive, Watford' };
    return checkDeliveryEligibility(formData.postcode);
  }, [formData.postcode, orderMode]);

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = appliedVoucher ? subtotal * appliedVoucher.discountPercent / 100 : 0;
  const deliveryFee = orderMode === 'delivery' && subtotal < 25 ? 2.50 : 0;
  const total = subtotal - discount + deliveryFee;

  const isValid = useMemo(() => {
    const hasName = formData.name.trim().length >= 2;
    const hasEmail = formData.email.includes('@');
    const hasPhone = formData.phone.trim().length >= 8;
    if (!hasName || !hasEmail || !hasPhone) return false;

    if (orderMode === 'delivery') {
      const hasAddress = formData.address.trim().length >= 3;
      const hasPostcode = formData.postcode.trim().length >= 3;
      if (!hasAddress || !hasPostcode || !radiusCheck.isEligible) return false;
    }

    if (formData.paymentMethod === 'card') {
      const cardClean = cardData.number.replace(/\s/g, '');
      if (cardClean.length < 16) return false;
    }

    return true;
  }, [formData, cardData, orderMode, radiusCheck]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-GB');

    setTimeout(() => {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setIsSubmitting(false);
      onOrderSuccess({
        orderType: orderMode,
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        deliveryAddress: orderMode === 'delivery' ? `${formData.address}, ${formData.postcode}` : 'Store Collection',
        deliveryPostcode: formData.postcode,
        deliveryNotes: formData.notes,
        items: cartItems,
        subtotal,
        discountAmount: discount,
        deliveryFee,
        total,
        voucherCode: appliedVoucher?.code || null,
        paymentMethod: formData.paymentMethod,
        orderTime: formattedTimestamp,
        createdAt: now.toISOString(),
        distanceKm: radiusCheck.distanceKm
      });
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} color="var(--red)" /> Checkout &amp; Order Summary
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
              {orderMode === 'delivery' ? '🚀 Delivery Order · Watford 5 km Zone' : '🏪 Store Collection'}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* 1-Form All-in-One Body */}
        <form onSubmit={handleSubmit} className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '20px' }}>
          
          {/* SECTION 1: CONTACT DETAILS */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text)' }}>
              1. Customer Contact Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <div className="input-group"><User size={16} /><input name="name" placeholder="Full Name *" value={formData.name} onChange={handleChange} required /></div>
              <div className="input-group"><Mail size={16} /><input name="email" type="email" placeholder="Email Address *" value={formData.email} onChange={handleChange} required /></div>
              <div className="input-group"><Phone size={16} /><input name="phone" type="tel" placeholder="Phone Number *" value={formData.phone} onChange={handleChange} required /></div>
            </div>
          </div>

          {/* SECTION 2: DELIVERY ADDRESS & 5 KM RADIUS */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text)' }}>
              2. {orderMode === 'delivery' ? 'Delivery Address & 5 km Radius Check' : 'Store Collection Details'}
            </h4>

            {orderMode === 'delivery' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div className="input-group"><MapPin size={16} /><input name="address" placeholder="Street Address *" value={formData.address} onChange={handleChange} required /></div>
                  <div className="input-group"><MapPin size={16} /><input name="postcode" placeholder="Postcode *" value={formData.postcode} onChange={handleChange} required /></div>
                </div>

                {/* 5 km Delivery Radius Badge */}
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: radiusCheck.isEligible ? 'var(--green-light)' : '#FEF2F2',
                  border: radiusCheck.isEligible ? '1px solid #A7F3D0' : '1px solid #FEE2E2',
                  marginBottom: '10px', fontSize: '0.84rem', fontWeight: 700,
                  color: radiusCheck.isEligible ? 'var(--green)' : 'var(--red)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  {radiusCheck.isEligible ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{radiusCheck.reason}</span>
                </div>

                <div className="input-group"><Truck size={16} /><input name="notes" placeholder="Delivery notes for driver (optional)" value={formData.notes} onChange={handleChange} /></div>
              </>
            ) : (
              <div style={{ background: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <p><strong>Collection Point:</strong> RFC Watford, 119 Courtlands Drive, Watford WD17 4HZ</p>
                <p style={{ color: 'var(--green)', fontWeight: 700, marginTop: '4px' }}>⏱️ Ready for pickup in 15-20 minutes</p>
              </div>
            )}
          </div>

          {/* SECTION 3: PAYMENT METHOD */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 800, marginBottom: '10px', color: 'var(--text)' }}>
              3. Payment Method
            </h4>
            <div className="payment-options" style={{ marginBottom: '10px' }}>
              {[
                { id: 'card', icon: <CreditCard size={18} />, label: 'Card' },
                { id: 'apple_pay', icon: <span style={{ fontSize: '1.2rem' }}></span>, label: 'Apple Pay' },
                { id: 'cash', icon: <Banknote size={18} />, label: 'Cash' },
              ].map(m => (
                <label key={m.id} className={`payment-card ${formData.paymentMethod === m.id ? 'selected' : ''}`} onClick={() => setFormData({ ...formData, paymentMethod: m.id })} style={{ padding: '12px' }}>
                  <input type="radio" name="paymentMethod" value={m.id} checked={formData.paymentMethod === m.id} readOnly />
                  {m.icon}
                  <span>{m.label}</span>
                </label>
              ))}
            </div>

            {formData.paymentMethod === 'card' && (
              <div className="card-details">
                <input name="number" placeholder="Card Number (16 digits)" value={cardData.number} onChange={handleCardChange} required />
                <div className="flex-row">
                  <input name="expiry" placeholder="MM/YY" value={cardData.expiry} onChange={handleCardChange} required />
                  <input name="cvv" type="password" placeholder="CVV" value={cardData.cvv} onChange={handleCardChange} required />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: ORDER SUMMARY BOX */}
          <div style={{ background: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', fontWeight: 800, marginBottom: '8px' }}>Order Basket Summary ({cartItems.length} items)</h4>
            {cartItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--text2)', padding: '2px 0' }}>
                <span>{item.quantity}x {item.name}</span>
                <span style={{ fontWeight: 700 }}>£{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Subtotal</span><span>£{subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--green)', fontWeight: 700 }}><span>Discount ({appliedVoucher?.code})</span><span>-£{discount.toFixed(2)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Delivery Fee</span><span>{deliveryFee === 0 ? 'FREE' : `£${deliveryFee.toFixed(2)}`}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, color: 'var(--red)', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
              <span>Total Amount</span>
              <span>£{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-submit-modal"
            disabled={!isValid || isSubmitting}
            style={{ width: '100%', marginTop: '18px', padding: '16px', fontSize: '1.05rem' }}
          >
            {isSubmitting ? 'Processing Order...' : <><Lock size={18} /> Complete &amp; Pay — £{total.toFixed(2)}</>}
          </button>
        </form>
      </div>
    </div>
  );
}
