import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, Banknote, CheckCircle, CreditCard, Lock, Mail, MapPin, Phone, Store, Truck, User, X, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { checkDeliveryEligibility, getDeliveryEligibility } from '../utils/deliveryRadius';
import { getCurrentUser } from '../services/customerAuth';
import { createPaymentIntent, getPublicConfig } from '../services/api';

const isValidStripePublishableKey = (value) => /^pk_(test|live)_[A-Za-z0-9]+$/.test(value || '');

export default function CheckoutModal(props) {
  const [stripeRuntime, setStripeRuntime] = useState({ status: 'idle', stripePromise: null });

  useEffect(() => {
    if (!props.isOpen) return undefined;

    let isActive = true;
    setStripeRuntime({ status: 'loading', stripePromise: null });
    getPublicConfig()
      .then(async (config) => {
        const publishableKey = config?.stripePublishableKey?.trim();
        if (!isValidStripePublishableKey(publishableKey)) {
          throw new Error('Stripe publishable key is missing or invalid.');
        }

        const stripePromise = loadStripe(publishableKey).catch(() => null);
        if (isActive) setStripeRuntime({ status: 'initializing', stripePromise, publishableKey });
        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe could not be initialized.');
        if (isActive) setStripeRuntime({ status: 'ready', stripePromise, publishableKey });
      })
      .catch((error) => {
        if (isActive) {
          setStripeRuntime((current) => ({
            status: 'unavailable',
            stripePromise: current.stripePromise,
            publishableKey: current.publishableKey,
            error: error.message
          }));
        }
      });

    return () => {
      isActive = false;
    };
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  if (stripeRuntime.status === 'idle' || stripeRuntime.status === 'loading') {
    return (
      <div className="modal-overlay">
        <div className="modal-card" style={{ maxWidth: '420px' }} role="dialog" aria-modal="true" aria-label="Loading secure checkout">
          <div className="modal-header">
            <h3>Preparing secure checkout</h3>
            <button type="button" className="close-btn" onClick={props.onClose} aria-label="Close checkout"><X size={18} /></button>
          </div>
          <div className="modal-body" style={{ padding: '28px', textAlign: 'center', color: 'var(--text2)' }}>
            Loading payment options…
          </div>
        </div>
      </div>
    );
  }

  return (
    <Elements key={stripeRuntime.publishableKey || 'cash-only'} stripe={stripeRuntime.stripePromise}>
      <CheckoutForm
        {...props}
        stripeConfigured={stripeRuntime.status === 'ready'}
        stripeUnavailableReason={stripeRuntime.status === 'initializing' ? 'The secure card form is still loading.' : stripeRuntime.error}
      />
    </Elements>
  );
}

function CheckoutForm({ isOpen, onClose, cartItems = [], orderMode: initialOrderMode = 'delivery', setOrderMode: setParentOrderMode, appliedVoucher, onOrderSuccess, stripeConfigured, stripeUnavailableReason }) {
  const stripe = useStripe();
  const elements = useElements();
  const [currentMode, setCurrentMode] = useState(initialOrderMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [radiusCheck, setRadiusCheck] = useState(() => checkDeliveryEligibility(''));
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false);
  const checkoutIdRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    notes: '',
    paymentMethod: 'cash'
  });

  useEffect(() => {
    let isActive = true;

    if (isOpen) {
      setIsCustomerAuthenticated(false);
      getCurrentUser()
        .then((user) => {
          if (!isActive) return;
          setIsCustomerAuthenticated(Boolean(user));
          if (!user) return;
          setFormData((prev) => ({
            ...prev,
            name: prev.name || user.name || '',
            email: prev.email || user.email || '',
            phone: prev.phone || user.phone || '',
            address: prev.address || user.address || '',
            postcode: prev.postcode || user.postcode || ''
          }));
        })
        .catch(() => {
          if (isActive) setIsCustomerAuthenticated(false);
        });
    }

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (currentMode === 'collection') {
      setRadiusCheck({ isEligible: true, isChecking: false, distanceKm: 0, reason: 'Store collection from 119 Courtlands Dr, Watford' });
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

  const buildOrderPayload = (stripePaymentIntentId = null, checkoutId = checkoutIdRef.current) => {
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
      checkoutId,
      orderTime: formattedTimestamp,
      createdAt: now.toISOString(),
      distanceKm: radiusCheck.distanceKm
    };
  };

  const confirmStripePayment = async (checkoutId) => {
    if (!stripeConfigured) throw new Error('Card payments are currently unavailable. Please choose cash or try again later.');
    if (!stripe || !elements) throw new Error('The secure card form is still loading. Please wait a moment and try again.');

    const card = elements.getElement(CardElement);
    if (!card) throw new Error('The secure card form could not be loaded. Please refresh and try again.');

    const intent = await createPaymentIntent({ checkoutId, order: buildOrderPayload(null, checkoutId) });
    if (!intent?.clientSecret) throw new Error('The payment service did not create a valid payment session.');

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
    if (result.paymentIntent?.status !== 'succeeded' || !result.paymentIntent.id) {
      throw new Error('Card payment was not confirmed. No order has been placed.');
    }
    return result.paymentIntent.id;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      if (!checkoutIdRef.current) {
        if (!globalThis.crypto?.randomUUID) {
          throw new Error('Secure checkout is unavailable in this browser. Please use a current browser and try again.');
        }
        checkoutIdRef.current = globalThis.crypto.randomUUID();
      }
      const checkoutId = checkoutIdRef.current;
      const stripePaymentIntentId = formData.paymentMethod === 'card'
        ? await confirmStripePayment(checkoutId)
        : null;

      await onOrderSuccess(buildOrderPayload(stripePaymentIntentId, checkoutId));
      confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 }, colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'] });
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
        fontSize: '13px',
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
          style={{ padding: '8px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            className="modal-card checkout-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{ 
              width: '100%', 
              maxWidth: '860px', 
              maxHeight: '94vh', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--surface)', 
              borderRadius: '20px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', 
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexShrink: 0, background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={16} color="var(--red)" /> Secure Checkout
                  </h3>
                  <span className="card-badge badge-bestseller" style={{ fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: '4px' }}>
                    <ShieldCheck size={10} /> SSL Secure
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text2)', margin: '1px 0 0 0' }}>
                  {currentMode === 'delivery' ? 'Hot & Fresh delivery to your Watford address' : 'Quick collection from Courtlands Drive'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="order-mode-toggle" style={{ background: '#FFF', border: '1px solid var(--border)', padding: '2px', borderRadius: 'var(--radius-full)', display: 'flex', gap: '2px' }}>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className={`mode-btn ${currentMode === 'delivery' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('delivery')}
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '0.75rem', 
                      fontWeight: 700,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: currentMode === 'delivery' ? 'var(--red)' : 'transparent',
                      color: currentMode === 'delivery' ? '#FFF' : 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <Truck size={12} /> Delivery
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className={`mode-btn ${currentMode === 'collection' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('collection')}
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '0.75rem', 
                      fontWeight: 700,
                      border: 'none', 
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: currentMode === 'collection' ? 'var(--red)' : 'transparent',
                      color: currentMode === 'collection' ? '#FFF' : 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <Store size={12} /> Collect
                  </motion.button>
                </div>

                <button className="close-btn" type="button" onClick={onClose} aria-label="Close checkout" style={{ border: 'none', background: 'var(--surface-alt)', borderRadius: '50%', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form id="checkout-form" onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 0 }}>
              
              {/* LEFT COLUMN: Contact, Address, Payment */}
              <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {submitError && (
                  <div style={{ padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> {submitError}
                  </div>
                )}

                {/* 1. Contact Details */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={14} color="var(--red)" /> 1. Contact Details
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <User size={14} color="var(--text3)" />
                      <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Mail size={14} color="var(--text3)" />
                        <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Phone size={14} color="var(--text3)" />
                        <input name="phone" type="tel" placeholder="Mobile Phone" value={formData.phone} onChange={handleChange} required style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Delivery Address / Collection */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {currentMode === 'delivery' ? <Truck size={14} color="var(--red)" /> : <Store size={14} color="var(--red)" />}
                    2. {currentMode === 'delivery' ? 'Delivery Address' : 'Collection Point'}
                  </h4>

                  {currentMode === 'delivery' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <MapPin size={14} color="var(--text3)" />
                          <input name="address" placeholder="Street Address" value={formData.address} onChange={handleChange} required style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                        </div>
                        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <MapPin size={14} color="var(--text3)" />
                          <input name="postcode" placeholder="Postcode" value={formData.postcode} onChange={handleChange} required style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                        </div>
                      </div>

                      {/* Radius Badge Pill */}
                      <div style={{
                        padding: '5px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        background: radiusCheck.isChecking ? '#FFFBEB' : radiusCheck.isEligible ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${radiusCheck.isChecking ? '#FDE68A' : radiusCheck.isEligible ? '#DCFCE7' : '#FEE2E2'}`,
                        color: radiusCheck.isChecking ? '#D97706' : radiusCheck.isEligible ? '#15803D' : '#DC2626'
                      }}>
                        {radiusCheck.isEligible && !radiusCheck.isChecking ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                        <span>{radiusCheck.reason}</span>
                      </div>

                      <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={14} color="var(--text3)" />
                        <input name="notes" placeholder="Delivery notes / Gate code (Optional)" value={formData.notes} onChange={handleChange} style={{ border: 'none', padding: '7px 0', width: '100%', outline: 'none', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-alt)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#FFF', color: 'var(--red)', padding: '6px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)' }}>
                        <Store size={18} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text)' }}>RFC Watford Kitchen</strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>119 Courtlands Drive, Watford WD17 4HZ</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Payment Method */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CreditCard size={14} color="var(--red)" /> 3. Payment Method
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                    {[
                      { id: 'card', icon: CreditCard, label: 'Credit / Debit Card' },
                      { id: 'cash', icon: Banknote, label: currentMode === 'delivery' ? 'Cash on Delivery' : 'Cash on Collection' }
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = formData.paymentMethod === method.id;
                      const isDisabled = method.id === 'card' && (!stripeConfigured || !isCustomerAuthenticated);
                      return (
                        <motion.label 
                          key={method.id} 
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          style={{ 
                            padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: isDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.78rem',
                            border: `2px solid ${isSelected ? 'var(--red)' : 'var(--border)'}`, 
                            background: isSelected ? '#FEF2F2' : '#FFF',
                            color: isSelected ? 'var(--red)' : 'var(--text)',
                            transition: 'all 0.15s ease',
                            opacity: isDisabled ? 0.55 : 1
                          }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.id}
                            checked={isSelected}
                            onChange={handleChange}
                            disabled={isDisabled}
                            style={{ display: 'none' }}
                          />
                          <Icon size={14} />
                          <span>{method.label}</span>
                        </motion.label>
                      );
                    })}
                  </div>

                  {formData.paymentMethod === 'card' && stripeConfigured && (
                    <div style={{ padding: '8px 10px', background: '#FFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ padding: '2px 0' }}>
                        <CardElement options={stripeStyle} />
                      </div>
                    </div>
                  )}
                  {!stripeConfigured && (
                    <div style={{ padding: '7px 10px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: '#92400E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> {stripeUnavailableReason || 'Card payments are unavailable.'} Cash checkout remains available.
                    </div>
                  )}
                  {stripeConfigured && !isCustomerAuthenticated && (
                    <div style={{ padding: '7px 10px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: '#92400E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Card payments require a signed-in customer account. Please use cash or sign in from the customer portal first.
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: Order Summary */}
              <div style={{ padding: '12px 16px', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 900, color: 'var(--text)', marginBottom: '8px' }}>
                    Order Summary ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
                  </h4>

                  {/* Cart Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                    {cartItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  <div style={{ marginTop: '10px', background: '#FFF', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text2)' }}>
                      <span>Subtotal</span>
                      <span>£{subtotal.toFixed(2)}</span>
                    </div>

                    {discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--green)', fontWeight: 800 }}>
                        <span>Voucher Discount ({appliedVoucher?.code})</span>
                        <span>-£{discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text2)' }}>
                      <span>Delivery Fee</span>
                      <span>{deliveryFee === 0 ? <span style={{ color: 'var(--green)', fontWeight: 800 }}>FREE</span> : `£${deliveryFee.toFixed(2)}`}</span>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '3px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 900, color: 'var(--text)' }}>Total to Pay</span>
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--red)' }}>
                        £{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </form>

            {/* PINNED STICKY FOOTER ACTION BAR WITH ANIMATIONS */}
            <div style={{ 
              padding: '10px 18px', 
              background: '#FFF', 
              borderTop: '1px solid var(--border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '14px',
              flexShrink: 0,
              zIndex: 30,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.06)'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Total Amount</span>
                <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--red)' }}>
                  £{total.toFixed(2)}
                </span>
              </div>

              <motion.button
                whileHover={{ scale: isValid && !isSubmitting ? 1.02 : 1 }}
                whileTap={{ scale: isValid && !isSubmitting ? 0.97 : 1 }}
                type="submit"
                form="checkout-form"
                className="btn-submit-modal"
                disabled={!isValid || isSubmitting}
                style={{ 
                  flex: 1,
                  maxWidth: '380px',
                  padding: '12px 20px', 
                  fontSize: '1.05rem', 
                  fontWeight: 900, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  background: (!isValid || isSubmitting) ? 'var(--text3)' : 'linear-gradient(135deg, var(--red), #DC2626)',
                  color: '#FFF', 
                  border: 'none', 
                  borderRadius: 'var(--radius-full)',
                  cursor: (!isValid || isSubmitting) ? 'not-allowed' : 'pointer',
                  boxShadow: (!isValid || isSubmitting) ? 'none' : '0 8px 20px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmitting ? (
                  <><span className="button-spinner" /> Processing Order...</>
                ) : (
                  <><Lock size={18} /> Place Order - £{total.toFixed(2)}</>
                )}
              </motion.button>
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
