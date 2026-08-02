import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const sections = [
  {
    id: 'collect',
    title: 'What we collect',
    copy: 'We collect your name, email, phone number, delivery address, order details, payment status, and feedback when you use the ordering service.'
  },
  {
    id: 'use',
    title: 'Why we use it',
    copy: 'Your details are used to prepare orders, deliver food, send receipts and service updates, prevent fraud, and support customer service.'
  },
  {
    id: 'payments',
    title: 'Payments',
    copy: 'Card details are processed by Stripe. RFC Watford stores payment status and Stripe payment references, not raw card numbers.'
  },
  {
    id: 'rights',
    title: 'Your rights',
    copy: 'You can request account deletion from your customer profile. Order records needed for accounting are retained with personal details anonymised.'
  }
];

export default function PrivacyPolicy({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="modal-card privacy-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
          >
            <div className="modal-header">
              <div>
                <h3>Privacy Policy</h3>
                <p className="modal-subtitle">How RFC Watford handles customer account and order information.</p>
              </div>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close privacy policy">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body policy-body">
              <div className="policy-content">
                {sections.map((section) => (
                  <section key={section.id} id={section.id} className="policy-section">
                    <h4>{section.title}</h4>
                    <p>{section.copy}</p>
                  </section>
                ))}
              </div>
              <nav className="privacy-toc" aria-label="Privacy sections">
                {sections.map((section) => (
                  <a key={section.id} href={`#${section.id}`}>{section.title}</a>
                ))}
              </nav>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

PrivacyPolicy.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
