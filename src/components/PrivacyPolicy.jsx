import { X } from 'lucide-react';
import PropTypes from 'prop-types';

export default function PrivacyPolicy({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card privacy-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Privacy Policy</h3>
            <p className="modal-subtitle">How RFC Watford handles customer account and order information.</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close privacy policy">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body policy-body">
          <h4>What we collect</h4>
          <p>We collect your name, email, phone number, delivery address, order details, payment status, and feedback when you use the ordering service.</p>

          <h4>Why we use it</h4>
          <p>Your details are used to prepare orders, deliver food, send receipts and service updates, prevent fraud, and support customer service.</p>

          <h4>Payments</h4>
          <p>Card details are processed by Stripe. RFC Watford stores payment status and Stripe payment reference numbers, not raw card numbers.</p>

          <h4>Your rights</h4>
          <p>You can request account deletion from your customer profile. Order records needed for accounting are retained with personal details anonymised.</p>
        </div>
      </div>
    </div>
  );
}

PrivacyPolicy.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
