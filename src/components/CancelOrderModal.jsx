import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

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
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              background: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--red)',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                Cancel Order #{order.orderNumber}?
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: '2px 0 0 0' }}>
                You can cancel active orders if delayed or made by mistake.
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '12px' }}>
            Please select a cancellation reason:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {CANCEL_REASONS.map((r, i) => {
              const isSelected = selectedReason === r;
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--red)' : '1px solid var(--border)',
                    background: isSelected ? '#FEF2F2' : 'var(--white)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={r}
                    checked={isSelected}
                    onChange={() => setSelectedReason(r)}
                    style={{ accentColor: 'var(--red)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text)' : 'var(--text2)' }}>
                    {r}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedReason === 'Other reason' && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
                Additional Comments
              </label>
              <textarea
                placeholder="Tell us why you are cancelling..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-alt)',
                  fontSize: '0.88rem',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text)',
                  minHeight: '80px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ gap: '10px' }}>
          <button
            type="button"
            className="mode-btn"
            onClick={onClose}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '12px 18px',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
          <button
            type="button"
            className="btn-submit-modal"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              flex: 1,
              justifyContent: 'center',
              background: 'var(--red)',
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

