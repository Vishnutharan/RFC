import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, Banknote, CheckCircle, CreditCard, Lock, Mail, MapPin, Phone, Store, Truck, User, X } from 'lucide-react';
import { checkDeliveryEligibility } from '../utils/deliveryRadius';
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

  const radiusCheck = useMemo(() => {
    if (orderMode === 'collection') {
      return { isEligible: true, distanceKm: 0, reason: 'Store collection from 119 Courtlands Drive, Watford' };
    }
    return checkDeliveryEligibility(formData.postcode);
  }, [formData.postcode, orderMode]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );
  const discount = appliedVoucher ? subtotal * appliedVoucher.discountPercent / 100 : 0;
  const deliveryFee = orderMode === 'delivery' && subtotal < 25 ? 2.50 : 0;
  const total = subtotal - discount + deliveryFee;

  const isValid = useMemo(() => {
    const hasCustomer = formData.name.trim().length >= 2 &&
      formData.email.includes('@') &&
      formData.phone.trim().length >= 8;

    if (!hasCustomer) return false;
    if (orderMode === 'delivery') {
      return formData.address.trim().length >= 3 &&
        formData.postcode.trim().length >= 3 &&
        radiusCheck.isEligible;
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
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      setSubmitError(error.message || 'Order could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card checkout-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3><Lock size={18} /> Checkout</h3>
            <p className="modal-subtitle">
              {orderMode === 'delivery' ? 'Delivery order in the Watford zone' : 'Store collection'}
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close checkout">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body checkout-body">
          {submitError && <div className="form-error">{submitError}</div>}

          <section className="checkout-section">
            <h4>Customer Contact Details</h4>
            <div className="checkout-grid">
              <div className="input-group"><User size={16} /><input name="name" placeholder="Full Name *" value={formData.name} onChange={handleChange} required /></div>
              <div className="input-group"><Mail size={16} /><input name="email" type="email" placeholder="Email Address *" value={formData.email} onChange={handleChange} required /></div>
              <div className="input-group"><Phone size={16} /><input name="phone" type="tel" placeholder="Phone Number *" value={formData.phone} onChange={handleChange} required /></div>
            </div>
          </section>

          <section className="checkout-section">
            <h4>{orderMode === 'delivery' ? 'Delivery Address' : 'Collection Details'}</h4>
            {orderMode === 'delivery' ? (
              <>
                <div className="checkout-address-grid">
                  <div className="input-group"><MapPin size={16} /><input name="address" placeholder="Street Address *" value={formData.address} onChange={handleChange} required /></div>
                  <div className="input-group"><MapPin size={16} /><input name="postcode" placeholder="Postcode *" value={formData.postcode} onChange={handleChange} required /></div>
                </div>
                <div className={`checkout-radius ${radiusCheck.isEligible ? 'ok' : 'error'}`}>
                  {radiusCheck.isEligible ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <span>{radiusCheck.reason}</span>
                </div>
                <div className="input-group"><Truck size={16} /><input name="notes" placeholder="Delivery notes for driver" value={formData.notes} onChange={handleChange} /></div>
              </>
            ) : (
              <div className="collection-panel">
                <Store size={18} />
                <div>
                  <strong>RFC Watford, 119 Courtlands Drive, Watford WD17 4HZ</strong>
                  <span>Ready for pickup in 15-20 minutes</span>
                </div>
              </div>
            )}
          </section>

          <section className="checkout-section">
            <h4>Payment Method</h4>
            <div className="payment-options">
              {[
                { id: 'card', icon: <CreditCard size={18} />, label: 'Card' },
                { id: 'cash', icon: <Banknote size={18} />, label: 'Cash' }
              ].map((method) => (
                <label key={method.id} className={`payment-card ${formData.paymentMethod === method.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={formData.paymentMethod === method.id}
                    onChange={handleChange}
                  />
                  {method.icon}
                  <span>{method.label}</span>
                </label>
              ))}
            </div>

            {formData.paymentMethod === 'card' && (
              <div className="stripe-card-panel">
                {!stripeConfigured && (
                  <div className="form-error">Stripe publishable key is missing. Use cash or configure VITE_STRIPE_PUBLISHABLE_KEY.</div>
                )}
                <CardElement options={{ hidePostalCode: true }} />
              </div>
            )}
          </section>

          <section className="checkout-summary">
            <h4>Order Basket Summary ({cartItems.length} items)</h4>
            {cartItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="summary-row">
                <span>{item.quantity}x {item.name}</span>
                <span>GBP {(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="summary-divider" />
            <div className="summary-row"><span>Subtotal</span><span>GBP {subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="summary-row discount"><span>Discount ({appliedVoucher?.code})</span><span>-GBP {discount.toFixed(2)}</span></div>}
            <div className="summary-row"><span>Delivery Fee</span><span>{deliveryFee === 0 ? 'FREE' : `GBP ${deliveryFee.toFixed(2)}`}</span></div>
            <div className="summary-total"><span>Total Amount</span><span>GBP {total.toFixed(2)}</span></div>
          </section>

          <button type="submit" className="btn-submit-modal checkout-submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Processing...' : <><Lock size={18} /> Complete Order - GBP {total.toFixed(2)}</>}
          </button>
        </form>
      </div>
    </div>
  );
}

CheckoutModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.array,
  orderMode: PropTypes.oneOf(['delivery', 'collection']).isRequired,
  appliedVoucher: PropTypes.object,
  onOrderSuccess: PropTypes.func.isRequired
};

CheckoutForm.propTypes = {
  ...CheckoutModal.propTypes,
  stripeConfigured: PropTypes.bool.isRequired
};
