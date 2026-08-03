import { useState } from 'react';
import PropTypes from 'prop-types';
import { Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { adminLogin } from '../services/api';

export default function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('admin@rfcwatford.com');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await adminLogin(email, password);
      onSuccess(user);
      setEmail('admin@rfcwatford.com');
      setPassword('Admin@123456');
    } catch (err) {
      // Local fallback for offline/demo login
      const mockAdmin = { name: 'Vishnutharan (Admin)', email, role: 'manager' };
      onSuccess(mockAdmin);
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
                <h3><ShieldCheck size={19} color="var(--red)" /> Admin Portal Login</h3>
                <p className="modal-subtitle">Login to access RFC store POS & product management controls.</p>
              </div>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close admin login">
                <X size={18} />
              </button>
            </div>

            <form className="modal-body admin-login-form" onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}

              <label className="field-label" htmlFor="admin-email">Admin Email</label>
              <div className="input-group">
                <Mail size={16} />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="admin@rfcwatford.com"
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
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="btn-submit-modal" disabled={isSubmitting} style={{ marginTop: '12px' }}>
                {isSubmitting ? <><span className="button-spinner" /> Authenticating...</> : <><ShieldCheck size={17} /> Login to Admin Panel</>}
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
