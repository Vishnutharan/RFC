import React, { useState } from 'react';
import { X, AlertTriangle, Clock, RotateCcw } from 'lucide-react';

const CANCEL_REASONS = [
  '⏱️ Delivery is delayed / taking too long',
  '✍️ Want to modify items in my order',
  '📍 Selected wrong address or order mode',
  'Ordered by mistake / changed my mind',
  'Other reason'
];

export default function CancelOrderModal({ isOpen, onClose, order, onConfirmCancel }) {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !order) return null;

  const handleSubmit = () => {
    setIsSubmitting(true);
    const reasonText = selectedReason === 'Other reason' && customNote ? customNote : selectedReason;
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirmCancel(order.id || order.orderNumber, reasonText);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="var(--red)" size={22} />
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)', color: 'var(--red)', fontSize: '1.15rem' }}>Cancel Order #{order.orderNumber}?</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>You can cancel active orders if delayed or made by mistake.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px' }}>Please select a cancellation reason:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {CANCEL_REASONS.map((r, i) => (
              <button
                key={i}
                className={`option-pill ${selectedReason === r ? 'selected' : ''}`}
                onClick={() => setSelectedReason(r)}
                style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              >
                <span>{r}</span>
              </button>
            ))}
          </div>

          {selectedReason === 'Other reason' && (
            <textarea
              placeholder="Tell us why you are cancelling..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', fontSize: '0.85rem', minHeight: '60px'
              }}
            />
          )}
        </div>

        <div className="modal-footer" style={{ gap: '10px' }}>
          <button className="btn-back" onClick={onClose} style={{ flex: 1 }}>Keep Order</button>
          <button
            className="btn-submit-modal"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ flex: 1, background: 'var(--red)' }}
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
