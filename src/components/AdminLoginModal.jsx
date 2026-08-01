import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { adminLogin } from '../services/api';

export default function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-login-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3><ShieldCheck size={18} /> Staff Login</h3>
            <p className="modal-subtitle">Access is restricted to authorised RFC staff.</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close staff login"><X size={18} /></button>
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
            {isSubmitting ? 'Checking...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
