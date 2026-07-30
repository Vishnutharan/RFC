import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, ChefHat, Bike, Home, ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import PrintReceiptModal from './PrintReceiptModal';
import CancelOrderModal from './CancelOrderModal';

const STEPS = [
  { label: 'Order Placed', icon: CheckCircle, msg: 'Your order has been received!' },
  { label: 'In Kitchen', icon: ChefHat, msg: 'Our chefs are preparing your food...' },
  { label: 'Out for Delivery', icon: Bike, msg: 'Your order is on its way!' },
  { label: 'Delivered', icon: Home, msg: 'Enjoy your meal! 🎉' },
];

export default function OrderTracker({ order, onNewOrder, onCancelOrder }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(55 * 60);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    const t1 = setTimeout(() => setCurrentStep(2), 8000);
    const t2 = setTimeout(() => setCurrentStep(3), 18000);
    const t3 = setTimeout(() => setCurrentStep(4), 35000);
    return () => { clearInterval(timer); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const isCancelled = order?.orderStatus === 'Cancelled';

  return (
    <div className="tracker-container">
      <div className="tracker-card">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{isCancelled ? '❌' : '🎉'}</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem', fontWeight: 900, color: isCancelled ? 'var(--red)' : 'var(--text)' }}>
            {isCancelled ? 'Order Cancelled' : 'Order Confirmed!'}
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginTop: '4px' }}>
            Order #{order?.orderNumber || 'RFC-000000'}
          </p>

          <p style={{ fontSize: '0.8rem', color: 'var(--text3)', marginTop: '2px', fontWeight: 600 }}>
            🕒 Placed at: {order?.orderTime || (order?.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : 'Just now')}
          </p>

          {!isCancelled && (
            <>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--red)', marginTop: '12px' }}>
                {mins}:{secs.toString().padStart(2, '0')}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>Estimated delivery time</p>
            </>
          )}
        </div>

        {!isCancelled && (
          <div className="status-timeline">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isDone = i + 1 < currentStep;
              const isActive = i + 1 === currentStep;
              return (
                <div key={i} className={`status-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                  <div className="step-circle">
                    {isDone ? <CheckCircle size={20} /> : <StepIcon size={18} />}
                  </div>
                  <span className="step-label">{s.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          textAlign: 'center', padding: '16px', borderRadius: 'var(--radius-sm)',
          margin: '20px 0', background: isCancelled ? '#FEF2F2' : 'var(--bg)',
          color: isCancelled ? 'var(--red)' : 'var(--text)', border: isCancelled ? '1px solid #FEE2E2' : 'none'
        }}>
          {isCancelled ? (
            <p style={{ fontWeight: 800 }}>⚠️ Reason: {order.cancellationReason || 'Order was cancelled by customer.'}</p>
          ) : (
            <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{STEPS[currentStep - 1].msg}</p>
          )}
        </div>

        {order && (
          <div className="receipt-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0 }}>Order Summary</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isCancelled && (currentStep < 3 || mins < 45) && (
                  <button
                    onClick={() => setIsCancelOpen(true)}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--radius-full)',
                      background: '#FEF2F2', color: 'var(--red)', border: '1px solid #FEE2E2',
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Cancel Order
                  </button>
                )}

                <button
                  onClick={() => setIsPrintOpen(true)}
                  className="btn-add-item"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Printer size={14} /> Print Receipt
                </button>
              </div>
            </div>

            {order.items && order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '6px 0', color: 'var(--text2)' }}>
                <span>{item.quantity}x {item.name}</span>
                <span>£{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: '10px', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem' }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--red)' }}>£{order.total?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        )}

        <button onClick={onNewOrder} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', padding: '14px', borderRadius: 'var(--radius-full)',
          background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: '0.95rem',
          marginTop: '24px', cursor: 'pointer', border: 'none', boxShadow: 'var(--shadow-red)'
        }}>
          <ArrowLeft size={16} /> Back to Menu
        </button>
      </div>

      <PrintReceiptModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        order={order}
      />

      <CancelOrderModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        order={order}
        onConfirmCancel={(orderId, reason) => {
          if (onCancelOrder) onCancelOrder(orderId, reason);
        }}
      />
    </div>
  );
}
