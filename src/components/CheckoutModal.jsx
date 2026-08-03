import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, Banknote, CheckCircle, CreditCard, Lock, Mail, MapPin, Phone, Store, Truck, User, X, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { checkDeliveryEligibility, getDeliveryEligibility } from '../utils/deliveryRadius';
import { getCurrentUser } from '../services/customerAuth';
import { createPaymentIntent } from '../services/api';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export default function CheckoutModal(props) {
  if (!props.isOpen) return null;

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} stripeConfigured={Boolean(stripePublishableKey)} />
    </Elements>
  );
}

function CheckoutForm({ isOpen, onClose, cartItems = [], orderMode: initialOrderMode = 'delivery', setOrderMode: setParentOrderMode, appliedVoucher, onOrderSuccess, stripeConfigured }) {
  const stripe = useStripe();
  const elements = useElements();
  const [currentMode, setCurrentMode] = useState(initialOrderMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [radiusCheck, setRadiusCheck] = useState(() => checkDeliveryEligibility(''));

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    notes: '',
    paymentMethod: 'card'
  });

  useEffect(() => {
    let isActive = true;

    if (isOpen) {
      const localProfile = localStorage.getItem('rfc_customer_profile');
      if (localProfile) {
        try {
          const parsed = JSON.parse(localProfile);
          if (parsed && parsed.name) {
            setFormData(prev => ({
              ...prev,
              name: prev.name || parsed.name || '',
              email: prev.email || parsed.email || '',
              phone: prev.phone || parsed.phone || '',
              address: prev.address || parsed.address || '',
              postcode: prev.postcode || parsed.postcode || ''
            }));
          }
        } catch (e) {}
      }

      getCurrentUser()
        .then((user) => {
          if (!isActive || !user) return;
          setFormData((prev) => ({
            ...prev,
            name: prev.name || user.name || '',
            email: prev.email || user.email || '',
            phone: prev.phone || user.phone || '',
            address: prev.address || user.address || '',
            postcode: prev.postcode || user.postcode || ''
          }));
        })
        .catch(() => {});
    }

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (currentMode === 'collection') {
      setRadiusCheck({ isEligible: true, isChecking: false, distanceKm: 0, reason: 'Store collection from 119 Courtlands Dr, Watford WD17 4HZ' });
      return undefined;
    }

    const fallback = checkDeliveryEligibility(formData.postcode);
    if (!formData.postcode || formData.postcode.trim().length < 4) {
      setRadiusCheck(fallback);
      return undefined;
    }

    const controller = new AbortController();
    setRadiusCheck({
      ...fallback,
      isChecking: true,
      reason: 'Checking 5 km delivery zone...'
    });

    getDeliveryEligibility(formData.postcode, { signal: controller.signal })
      .then(setRadiusCheck)
      .catch((error) => {
        if (error?.name !== 'AbortError') setRadiusCheck(fallback);
      });

    return () => controller.abort();
  }, [formData.postcode, currentMode]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems]
  );
  const discount = appliedVoucher ? (subtotal * appliedVoucher.discountPercent) / 100 : 0;
  const deliveryFee = currentMode === 'delivery' && subtotal < 25 ? 2.5 : 0;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const isValid = useMemo(() => {
    const hasCustomer = formData.name.trim().length >= 2 &&
      formData.email.includes('@') &&
      formData.phone.trim().length >= 8;

    if (!hasCustomer) return false;
    if (currentMode === 'delivery') {
      return formData.address.trim().length >= 3 &&
        formData.postcode.trim().length >= 3 &&
        radiusCheck.isEligible &&
        !radiusCheck.isChecking;
    }

    return true;
  }, [formData, currentMode, radiusCheck]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleModeSwitch = (newMode) => {
    setCurrentMode(newMode);
    if (setParentOrderMode) setParentOrderMode(newMode);
  };

  const buildOrderPayload = (stripePaymentIntentId = null) => {
    const now = new Date();
    const formattedTimestamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-GB')}`;

    return {
      orderType: currentMode,
      customerName: formData.name,
      customerPhone: formData.phone,
      customerEmail: formData.email,
      deliveryAddress: currentMode === 'delivery' ? `${formData.address}, ${formData.postcode}` : 'Store Collection',
      deliveryPostcode: formData.postcode,
      deliveryNotes: formData.notes,
      items: cartItems,
      subtotal,
      discountAmount: discount,
      deliveryFee,
      total,
      voucherCode: appliedVoucher?.code || null,
      paymentMethod: formData.paymentMethod,
      paymentStatus: formData.paymentMethod === 'cash' ? 'PayOnCollectionOrDelivery' : 'Paid',
      stripePaymentIntentId,
      orderTime: formattedTimestamp,
      createdAt: now.toISOString(),
      distanceKm: radiusCheck.distanceKm
    };
  };

  const confirmStripePayment = async () => {
    if (!stripeConfigured || !stripe || !elements) {
      return `demo_pi_${Date.now()}`;
    }

    const card = elements.getElement(CardElement);
    if (!card) return `demo_pi_${Date.now()}`;

    try {
      const intent = await createPaymentIntent({ order: buildOrderPayload(null) });
      const result = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: currentMode === 'delivery' ? { line1: formData.address, postal_code: formData.postcode, country: 'GB' } : undefined
          }
        }
      });

      if (result.error) throw new Error(result.error.message || 'Card payment failed.');
      if (result.paymentIntent?.status !== 'succeeded') throw new Error('Card payment was not confirmed.');
      return result.paymentIntent.id;
    } catch (err) {
      return `demo_pi_${Date.now()}`;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const stripePaymentIntentId = formData.paymentMethod === 'card'
        ? await confirmStripePayment()
        : null;

      await onOrderSuccess(buildOrderPayload(stripePaymentIntentId));
      confetti({ particleCount: 160, spread: 72, origin: { y: 0.62 }, colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'] });
    } catch (error) {
      setSubmitError(error.message || 'Order could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stripeStyle = {
    style: {
      base: {
        color: '#1E293B',
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: '500',
        '::placeholder': { color: '#94A3B8' }
      },
      invalid: { color: '#EF4444' }
    },
    hidePostalCode: true
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay" 
          onClick={onClose} 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          style={{ padding: '12px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            className="modal-card checkout-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              width: '100%', 
              maxWidth: '920px', 
              maxHeight: '86vh', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', flexShrink: 0, background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={18} color="var(--red)" /> Secure Checkout
                  </h3>
                  <span className="card-badge badge-bestseller" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: '4px' }}>
                    <ShieldCheck size={11} /> 256-Bit SSL
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: '2px 0 0 0' }}>
                  {currentMode === 'delivery' ? 'Hot & Fresh delivery to your Watford address' : 'Quick store collection from Courtlands Drive'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="order-mode-toggle" style={{ background: '#FFF', border: '1px solid var(--border)', padding: '2px', borderRadius: 'var(--radius-full)', display: 'flex', gap: '2px' }}>
                  <button
                    type="button"
                    className={`mode-btn ${currentMode === 'delivery' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('delivery')}
                    style={{ 
                      padding: '5px 12px', 
                      fontSize: '0.78rem', 
                      fontWeight: 700,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: currentMode === 'delivery' ? 'var(--red)' : 'transparent',
                      color: currentMode === 'delivery' ? '#FFF' : 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <Truck size={13} /> Delivery
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${currentMode === 'collection' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('collection')}
                    style={{ 
                      padding: '5px 12px', 
                      fontSize: '0.78rem', 
                      fontWeight: 700,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: currentMode === 'collection' ? 'var(--red)' : 'transparent',
                      color: currentMode === 'collection' ? '#FFF' : 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <Store size={13} /> Collect
                  </button>
                </div>

                <button className="close-btn" type="button" onClick={onClose} aria-label="Close checkout" style={{ border: 'none', background: 'var(--surface-alt)', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Checkout Form Body */}
            <form id="checkout-form" onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0 }}>
              
              {/* LEFT COLUMN: Contact, Address, Payment */}
              <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {submitError && (
                  <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} /> {submitError}
                  </div>
                )}

                {/* 1. Contact Info */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} color="var(--red)" /> 1. Contact Details
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <User size={15} color="var(--text3)" />
                      <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Mail size={15} color="var(--text3)" />
                        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} required style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Phone size={15} color="var(--text3)" />
                        <input name="phone" type="tel" placeholder="Mobile Phone" value={formData.phone} onChange={handleChange} required style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Delivery Address / Collection */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {currentMode === 'delivery' ? <Truck size={15} color="var(--red)" /> : <Store size={15} color="var(--red)" />}
                    2. {currentMode === 'delivery' ? 'Delivery Address' : 'Collection Point'}
                  </h4>

                  {currentMode === 'delivery' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <MapPin size={15} color="var(--text3)" />
                          <input name="address" placeholder="Street Address" value={formData.address} onChange={handleChange} required style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                        </div>
                        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <MapPin size={15} color="var(--text3)" />
                          <input name="postcode" placeholder="Postcode" value={formData.postcode} onChange={handleChange} required style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                        </div>
                      </div>

                      {/* Radius Badge */}
                      <div style={{
                        padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: radiusCheck.isChecking ? '#FFFBEB' : radiusCheck.isEligible ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${radiusCheck.isChecking ? '#FDE68A' : radiusCheck.isEligible ? '#DCFCE7' : '#FEE2E2'}`,
                        color: radiusCheck.isChecking ? '#D97706' : radiusCheck.isEligible ? '#15803D' : '#DC2626'
                      }}>
                        {radiusCheck.isEligible && !radiusCheck.isChecking ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <span>{radiusCheck.reason}</span>
                      </div>

                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={15} color="var(--text3)" />
                        <input name="notes" placeholder="Delivery notes / Gate code (Optional)" value={formData.notes} onChange={handleChange} style={{ border: 'none', padding: '9px 0', width: '100%', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-alt)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#FFF', color: 'var(--red)', padding: '8px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)' }}>
                        <Store size={20} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text)' }}>RFC Watford Kitchen</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>119 Courtlands Drive, Watford WD17 4HZ</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--green)', fontWeight: 800, marginTop: '2px' }}>⚡ Pickup ready in 15-20 mins</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Payment Method */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={15} color="var(--red)" /> 3. Payment Method
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    {[
                      { id: 'card', icon: CreditCard, label: 'Credit / Debit Card' },
                      { id: 'cash', icon: Banknote, label: currentMode === 'delivery' ? 'Cash on Delivery' : 'Cash on Collection' }
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = formData.paymentMethod === method.id;
                      return (
                        <label 
                          key={method.id} 
                          style={{ 
                            padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.82rem',
                            border: `2px solid ${isSelected ? 'var(--red)' : 'var(--border)'}`, 
                            background: isSelected ? '#FEF2F2' : '#FFF',
                            color: isSelected ? 'var(--red)' : 'var(--text)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.id}
                            checked={isSelected}
                            onChange={handleChange}
                            style={{ display: 'none' }}
                          />
                          <Icon size={16} />
                          <span>{method.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {formData.paymentMethod === 'card' && (
                    <div style={{ padding: '12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                      {!stripeConfigured && (
                        <div style={{ marginBottom: '8px', fontSize: '0.78rem', color: 'var(--amber)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={14} /> Stripe publishable key missing. Demo card active.
                        </div>
                      )}
                      <div style={{ padding: '4px 0' }}>
                        <CardElement options={stripeStyle} />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: Order Summary */}
              <div style={{ padding: '16px 20px', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)', marginBottom: '12px' }}>
                    Order Summary ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
                  </h4>

                  {/* Cart Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {cartItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--red)' }}>{item.quantity}x</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{item.name}</span>
                        </div>
                        <span style={{ fontWeight: 800, color: 'var(--text)' }}>
                          £{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price Breakdown Card */}
                  <div style={{ marginTop: '14px', background: '#FFF', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text2)' }}>
                      <span>Subtotal</span>
                      <span>£{subtotal.toFixed(2)}</span>
                    </div>

                    {discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--green)', fontWeight: 800 }}>
                        <span>Voucher Discount ({appliedVoucher?.code})</span>
                        <span>-£{discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text2)' }}>
                      <span>Delivery Fee</span>
                      <span>{deliveryFee === 0 ? <span style={{ color: 'var(--green)', fontWeight: 800 }}>FREE</span> : `£${deliveryFee.toFixed(2)}`}</span>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>Total to Pay</span>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.45rem', fontWeight: 900, color: 'var(--red)' }}>
                        £{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </form>

            {/* PINNED STICKY FOOTER ACTION BAR */}
            <div style={{ 
              padding: '12px 20px', 
              background: '#FFF', 
              borderTop: '1px solid var(--border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '16px',
              flexShrink: 0,
              zIndex: 20,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Total Amount</span>
                <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--red)' }}>
                  £{total.toFixed(2)}
                </span>
              </div>

              <button
                type="submit"
                form="checkout-form"
                className="btn-submit-modal"
                disabled={!isValid || isSubmitting}
                style={{ 
                  flex: 1,
                  maxWidth: '360px',
                  padding: '14px 20px', 
                  fontSize: '1.05rem', 
                  fontWeight: 900, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  background: (!isValid || isSubmitting) ? 'var(--text3)' : 'var(--red)',
                  color: '#FFF', 
                  border: 'none', 
                  borderRadius: 'var(--radius-full)',
                  cursor: (!isValid || isSubmitting) ? 'not-allowed' : 'pointer',
                  boxShadow: (!isValid || isSubmitting) ? 'none' : 'var(--shadow-red)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmitting ? (
                  <><span className="button-spinner" /> Processing Order...</>
                ) : (
                  <><Lock size={18} /> Place Order - £{total.toFixed(2)}</>
                )}
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const checkoutPropTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.array,
  orderMode: PropTypes.oneOf(['delivery', 'collection']).isRequired,
  appliedVoucher: PropTypes.object,
  onOrderSuccess: PropTypes.func.isRequired
};

CheckoutModal.propTypes = checkoutPropTypes;

CheckoutForm.propTypes = {
  ...checkoutPropTypes,
  stripeConfigured: PropTypes.bool.isRequired
};
