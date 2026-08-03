import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, Banknote, CheckCircle, CreditCard, Lock, Mail, MapPin, Phone, Store, Truck, User, X } from 'lucide-react';
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
    if (orderMode === 'collection') {
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
  }, [formData.postcode, orderMode]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cartItems]
  );
  const discount = appliedVoucher ? (subtotal * appliedVoucher.discountPercent) / 100 : 0;
  const deliveryFee = orderMode === 'delivery' && subtotal < 25 ? 2.5 : 0;
  const total = subtotal - discount + deliveryFee;

  const isValid = useMemo(() => {
    const hasCustomer = formData.name.trim().length >= 2 &&
      formData.email.includes('@') &&
      formData.phone.trim().length >= 8;

    if (!hasCustomer) return false;
    if (orderMode === 'delivery') {
      return formData.address.trim().length >= 3 &&
        formData.postcode.trim().length >= 3 &&
        radiusCheck.isEligible &&
        !radiusCheck.isChecking;
    }

    return true;
  }, [formData, orderMode, radiusCheck]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const buildOrderPayload = (stripePaymentIntentId = null) => {
    const now = new Date();
    const formattedTimestamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-GB')}`;

    return {
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
      paymentStatus: formData.paymentMethod === 'cash' ? 'PayOnCollectionOrDelivery' : 'Paid',
      stripePaymentIntentId,
      orderTime: formattedTimestamp,
      createdAt: now.toISOString(),
      distanceKm: radiusCheck.distanceKm
    };
  };

  const confirmStripePayment = async () => {
    if (!stripeConfigured || !stripe || !elements) {
      throw new Error('Card payments are not configured yet. Please choose cash or add a Stripe publishable key.');
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
          address: orderMode === 'delivery' ? { line1: formData.address, postal_code: formData.postcode, country: 'GB' } : undefined
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
      confetti({ particleCount: 160, spread: 72, origin: { y: 0.62 }, colors: ['#E8A93F', '#4ADE80', '#F3F4F6'] });
    } catch (error) {
      setSubmitError(error.message || 'Order could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stripeStyle = {
    style: {
      base: {
        color: '#F3F4F6',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        '::placeholder': { color: '#737B8C' }
      },
      invalid: { color: '#FFB4B1' }
    },
    hidePostalCode: true
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="modal-card checkout-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
          >
            <div className="modal-header">
              <div>
                <h3><Lock size={19} /> Checkout</h3>
                <p className="modal-subtitle">
                  {orderMode === 'delivery' ? 'Delivery in the Watford zone' : 'Collection from Courtlands Drive'}
                </p>
              </div>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close checkout">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body checkout-body">
              <div className="checkout-stepper" aria-label="Checkout progress">
                {['Cart', 'Details', 'Payment', 'Confirm'].map((step, index) => (
                  <span key={step} className={`checkout-step ${index <= 2 ? 'active' : ''}`}>{step}</span>
                ))}
              </div>

              {submitError && <div className="form-error">{submitError}</div>}

              <section className="checkout-section">
                <h4>Customer details</h4>
                <div className="checkout-grid">
                  <label className="input-group">
                    <User size={16} />
                    <input name="name" placeholder="Full name" value={formData.name} onChange={handleChange} required />
                  </label>
                  <label className="input-group">
                    <Mail size={16} />
                    <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
                  </label>
                  <label className="input-group">
                    <Phone size={16} />
                    <input name="phone" type="tel" placeholder="Phone" value={formData.phone} onChange={handleChange} required />
                  </label>
                </div>
              </section>

              <section className="checkout-section">
                <h4>{orderMode === 'delivery' ? 'Delivery address' : 'Collection details'}</h4>
                {orderMode === 'delivery' ? (
                  <>
                    <div className="checkout-address-grid">
                      <label className="input-group">
                        <MapPin size={16} />
                        <input name="address" placeholder="Street address" value={formData.address} onChange={handleChange} required />
                      </label>
                      <label className="input-group">
                        <MapPin size={16} />
                        <input name="postcode" placeholder="Postcode" value={formData.postcode} onChange={handleChange} required />
                      </label>
                    </div>
                    <div className={`checkout-radius ${radiusCheck.isChecking ? 'checking' : radiusCheck.isEligible ? 'ok' : 'error'}`}>
                      {radiusCheck.isEligible && !radiusCheck.isChecking ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                      <span>{radiusCheck.reason}</span>
                    </div>
                    <label className="input-group">
                      <Truck size={16} />
                      <input name="notes" placeholder="Delivery notes" value={formData.notes} onChange={handleChange} />
                    </label>
                  </>
                ) : (
                  <div className="collection-panel">
                    <Store size={19} />
                    <div>
                      <strong>RFC Watford, 119 Courtlands Drive, Watford WD17 4HZ</strong>
                      <span>Ready in 15 to 20 minutes</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="checkout-section">
                <h4>Payment method</h4>
                <div className="payment-options-grid">
                  {[
                    { id: 'card', icon: CreditCard, label: 'Card' },
                    { id: 'cash', icon: Banknote, label: 'Cash' }
                  ].map((method) => {
                    const Icon = method.icon;
                    return (
                      <label key={method.id} className={`payment-card ${formData.paymentMethod === method.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={formData.paymentMethod === method.id}
                          onChange={handleChange}
                        />
                        <Icon size={19} />
                        <span>{method.label}</span>
                      </label>
                    );
                  })}
                </div>

                {formData.paymentMethod === 'card' && (
                  <div className="stripe-card-panel">
                    {!stripeConfigured && (
                      <div className="form-error">Stripe publishable key is missing. Choose cash or configure VITE_STRIPE_PUBLISHABLE_KEY.</div>
                    )}
                    <CardElement options={stripeStyle} />
                  </div>
                )}
              </section>

              <section className="checkout-summary">
                <h4>Order summary</h4>
                <div className="summary-thumbs">
                  {cartItems.slice(0, 8).map((item, index) => (
                    item.item?.imageUrl ? (
                      <img key={`${item.id}-${index}`} className="summary-thumb" src={item.item.imageUrl} alt={item.name} loading="lazy" />
                    ) : (
                      <span key={`${item.id}-${index}`} className="summary-thumb cart-item-thumb-fallback">RFC</span>
                    )
                  ))}
                </div>
                {cartItems.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="summary-row">
                    <span>{item.quantity}x {item.name}</span>
                    <span>GBP {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                  </div>
                ))}
                <div className="summary-divider" />
                <div className="summary-row"><span>Subtotal</span><span>GBP {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="summary-row discount"><span>Discount ({appliedVoucher?.code})</span><span>-GBP {discount.toFixed(2)}</span></div>}
                <div className="summary-row"><span>Delivery fee</span><span>{deliveryFee === 0 ? 'Free' : `GBP ${deliveryFee.toFixed(2)}`}</span></div>
                <div className="summary-total"><span>Total</span><span>GBP {total.toFixed(2)}</span></div>
              </section>

              <button type="submit" className="btn-submit-modal checkout-submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="button-spinner" /> Confirming payment
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Place Order - GBP {total.toFixed(2)}
                  </>
                )}
              </button>
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
