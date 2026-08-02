import { useState } from 'react';
import PropTypes from 'prop-types';
import { Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { adminLogin } from '../services/api';

export default function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await adminLogin(email, password);
      onSuccess(user);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Staff login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="modal-card admin-login-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
          >
            <div className="modal-header">
              <div>
                <h3><ShieldCheck size={19} /> Staff Login</h3>
                <p className="modal-subtitle">Restricted RFC operations access.</p>
              </div>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close staff login">
                <X size={18} />
              </button>
            </div>

            <form className="modal-body admin-login-form" onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}

              <label className="field-label" htmlFor="admin-email">Email</label>
              <div className="input-group">
                <Mail size={16} />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <label className="field-label" htmlFor="admin-password">Password</label>
              <div className="input-group">
                <Lock size={16} />
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={8}
                />
              </div>

              <button type="submit" className="btn-submit-modal" disabled={isSubmitting}>
                {isSubmitting ? <><span className="button-spinner" /> Checking</> : <><ShieldCheck size={17} /> Login</>}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

AdminLoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired
};
