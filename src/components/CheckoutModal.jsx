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

function CheckoutForm({ isOpen, onClose, cartItems = [], orderMode, appliedVoucher, onOrderSuccess, stripeConfigured }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  // Local mode state to allow toggle inside modal
  const [currentMode, setCurrentMode] = useState(orderMode || 'delivery');
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
      setCurrentMode(orderMode); // sync on open
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
  }, [isOpen, orderMode]);

  useEffect(() => {
    if (currentMode === 'collection') {
      setRadiusCheck({ isEligible: true, isChecking: false, distanceKm: 0, reason: 'Store collection from 119 Courtlands Dr, Watford WD17 4HZ' });
      return undefined;
    }

    const fallback = checkDeliveryEligibility(formData.postcode);
    if (!formData.postcode || formData.postcode.trim().length < 5) {
      setRadiusCheck(fallback);
      return undefined;
    }

    const controller = new AbortController();
    setRadiusCheck({
      ...fallback,
      isChecking: true,
      reason: 'Checking exact 5 km delivery radius...'
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
  const total = subtotal - discount + deliveryFee;

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
    if (!stripeConfigured) {
      console.warn('Stripe not configured. Using mock demo payment.');
      return 'pi_demo_mock_12345';
    }

    if (!stripe || !elements) {
      throw new Error('Stripe is still loading. Please try again in a moment.');
    }

    const card = elements.getElement(CardElement);
    if (!card) throw new Error('Card details are not ready.');

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
      confetti({ particleCount: 160, spread: 72, origin: { y: 0.62 }, colors: ['#E52929', '#10B981', '#F59E0B'] });
    } catch (error) {
      setSubmitError(error.message || 'Order could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stripeStyle = {
    style: {
      base: {
        color: '#1E293B',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        '::placeholder': { color: '#64748B' }
      },
      invalid: { color: '#E52929' }
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
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <motion.div
            className="modal-card checkout-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{ 
              width: '100%', 
              maxWidth: '1000px', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-lg)', 
              overflow: 'hidden' 
            }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={20} color="var(--red)" /> Secure Checkout
                  </h3>
                  <span className="card-badge badge-bestseller" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: '4px' }}>
                    <ShieldCheck size={11} /> 256-Bit SSL Secure
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text2)', margin: '4px 0 0 0' }}>
                  {currentMode === 'delivery' ? 'Delivery directly to your doorstep in Watford' : 'Quick collection from Courtlands Drive'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Order Mode Switcher */}
                <div className="order-mode-toggle" style={{ background: 'var(--surface-alt)', padding: '4px', borderRadius: 'var(--radius-full)', display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={`mode-btn ${currentMode === 'delivery' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('delivery')}
                    style={{ 
                      padding: '6px 14px', 
                      fontSize: '0.85rem', 
                      fontWeight: 600,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: currentMode === 'delivery' ? '#FFF' : 'transparent',
                      color: currentMode === 'delivery' ? 'var(--text)' : 'var(--text2)',
                      boxShadow: currentMode === 'delivery' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Truck size={15} /> Delivery
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${currentMode === 'collection' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('collection')}
                    style={{ 
                      padding: '6px 14px', 
                      fontSize: '0.85rem', 
                      fontWeight: 600,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: currentMode === 'collection' ? '#FFF' : 'transparent',
                      color: currentMode === 'collection' ? 'var(--text)' : 'var(--text2)',
                      boxShadow: currentMode === 'collection' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Store size={15} /> Collect
                  </button>
                </div>

                <button className="close-btn" type="button" onClick={onClose} aria-label="Close checkout" style={{ border: 'none', background: 'var(--surface-alt)', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 0, maxHeight: '80vh', overflowY: 'auto' }}>
              
              {/* LEFT COLUMN: Contact, Address, Payment */}
              <div style={{ padding: '24px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Stepper Header (1. Details -> 2. Address -> 3. Payment) */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  {['Details', currentMode === 'delivery' ? 'Address' : 'Collection', 'Payment'].map((step, idx) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--red)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>{idx + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} /> {submitError}
                  </div>
                )}

                {/* 1. Contact Info */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={17} color="var(--red)" /> 1. Contact Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <User size={16} color="var(--text2)" />
                      <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Mail size={16} color="var(--text2)" />
                        <input name="email" type="email" placeholder="Email address" value={formData.email} onChange={handleChange} required style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Phone size={16} color="var(--text2)" />
                        <input name="phone" type="tel" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Delivery Address or Collection Details */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {currentMode === 'delivery' ? <Truck size={17} color="var(--red)" /> : <Store size={17} color="var(--red)" />}
                    2. {currentMode === 'delivery' ? 'Delivery Address' : 'Store Collection Point'}
                  </h4>

                  {currentMode === 'delivery' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <MapPin size={16} color="var(--text2)" />
                        <input name="address" placeholder="Street Address" value={formData.address} onChange={handleChange} required style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <MapPin size={16} color="var(--text2)" />
                        <input name="postcode" placeholder="Postcode" value={formData.postcode} onChange={handleChange} required style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>

                      {/* Radius Badge */}
                      <div style={{
                        padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: radiusCheck.isChecking ? '#FFFBEB' : radiusCheck.isEligible ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${radiusCheck.isChecking ? '#FDE68A' : radiusCheck.isEligible ? '#DCFCE7' : '#FEE2E2'}`,
                        color: radiusCheck.isChecking ? '#D97706' : radiusCheck.isEligible ? '#15803D' : '#DC2626'
                      }}>
                        {radiusCheck.isEligible && !radiusCheck.isChecking ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        <span>{radiusCheck.reason}</span>
                      </div>

                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={16} color="var(--text2)" />
                        <input name="notes" placeholder="Delivery Notes (Optional)" value={formData.notes} onChange={handleChange} style={{ border: 'none', padding: '12px 0', width: '100%', outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ background: 'var(--white)', color: 'var(--red)', padding: '12px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)' }}>
                        <Store size={24} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text)' }}>RFC Watford Store</strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>119 Courtlands Drive, Watford WD17 4HZ</span>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 700, marginTop: '4px' }}>⚡ Ready for pickup in 15-20 mins</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Payment Method */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={17} color="var(--red)" /> 3. Payment Method
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
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
                            padding: '14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '0.9rem',
                            border: `2px solid ${isSelected ? 'var(--red)' : 'var(--border)'}`, 
                            background: isSelected ? '#FEF2F2' : '#FFF',
                            color: isSelected ? 'var(--red)' : 'var(--text)',
                            transition: 'all 0.2s'
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
                          <Icon size={20} />
                          <span>{method.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {formData.paymentMethod === 'card' && (
                    <div style={{ padding: '16px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                      {!stripeConfigured && (
                        <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={16} /> Stripe not configured. Demo mode active.
                        </div>
                      )}
                      <div style={{ padding: '8px 0' }}>
                        <CardElement options={stripeStyle} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text3)', display: 'block', marginTop: '12px' }}>
                        🔒 Payments are encrypted and processed securely by Stripe.
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: Order Summary & Place Order Button */}
              <div style={{ padding: '24px', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', marginBottom: '16px' }}>
                    Order Summary
                  </h4>

                  {/* Cart Items Thumbnails */}
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px dashed var(--border)' }}>
                    {cartItems.map((item, index) => (
                      <div key={`${item.id}-${index}`} style={{ flexShrink: 0, position: 'relative' }}>
                        {item.item?.imageUrl ? (
                          <img src={item.item.imageUrl} alt={item.name} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: 'var(--radius-xs)', boxShadow: 'var(--shadow-sm)' }} />
                        ) : (
                          <div style={{ width: '56px', height: '56px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text2)', fontWeight: 600 }}>RFC</div>
                        )}
                        <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--text)', color: 'white', fontSize: '0.7rem', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Cart Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                    {cartItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '0.9rem' }}>
                        <span><strong style={{ color: 'var(--text)' }}>{item.quantity}x</strong> {item.name}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          £{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price Totals Breakdown */}
                  <div style={{ marginTop: '24px', background: '#FFF', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text2)' }}>
                      <span>Subtotal</span>
                      <span>£{subtotal.toFixed(2)}</span>
                    </div>

                    {discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--green)', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{appliedVoucher?.code}</span> Discount</span>
                        <span>-£{discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text2)' }}>
                      <span>Delivery Fee</span>
                      <span>{deliveryFee === 0 ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>FREE</span> : `£${deliveryFee.toFixed(2)}`}</span>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>Total to Pay</span>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--red)' }}>
                        £{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Place Order Button */}
                <div>
                  <button
                    type="submit"
                    className="btn-submit-modal"
                    disabled={!isValid || isSubmitting}
                    style={{ 
                      width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: 700, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      background: (!isValid || isSubmitting) ? 'var(--text3)' : 'var(--red)',
                      color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: (!isValid || isSubmitting) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: (!isValid || isSubmitting) ? 'none' : 'var(--shadow-red)'
                    }}
                  >
                    {isSubmitting ? (
                      <><span style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Processing Order...</>
                    ) : (
                      <><Lock size={20} /> Place Order - £{total.toFixed(2)}</>
                    )}
                  </button>
                  {!isValid && (
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text3)', margin: '12px 0 0 0' }}>
                      Please complete all required fields to continue
                    </p>
                  )}
                </div>
              </div>

            </form>
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
