import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowLeft, Bike, CheckCircle, ChefHat, Clock, Home, Printer, Store, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import PrintReceiptModal from './PrintReceiptModal';
import CancelOrderModal from './CancelOrderModal';
import { useSignalR } from '../hooks/useSignalR';
import { refreshOrderEta } from '../services/api';

const STORE_LOCATION = { lat: 51.682366, lng: -0.41867 };
const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const STEPS = [
  { label: 'Order Placed', status: 'Placed', icon: CheckCircle, msg: 'We have received your order and sent it to the kitchen.', color: 'var(--indigo)' },
  { label: 'In Kitchen', status: 'Preparing', icon: ChefHat, msg: 'Chef Tharan is preparing your food fresh.', color: 'var(--amber)' },
  { label: 'On Its Way', status: 'Out for Delivery', icon: Bike, msg: 'Estimated delivery time is being refreshed from the store route.', color: 'var(--red)' },
  { label: 'Delivered', status: 'Completed', icon: Home, msg: 'Enjoy your meal while it is hot.', color: 'var(--green)' }
];

const STATUS_STEP = {
  Placed: 1,
  Preparing: 2,
  'Ready for Collection': 3,
  'Out for Delivery': 3,
  Completed: 4,
  Delivered: 4
};

const getOrderItemName = (item) => item.name || item.item?.name || 'Menu item';
const getOrderItemUnitPrice = (item) => Number(item.price ?? item.unitPrice ?? item.item?.price ?? 0);

export default function OrderTracker({ order, onNewOrder, onCancelOrder, showToast }) {
  const [trackedOrder, setTrackedOrder] = useState(order);
  const [timeLeft, setTimeLeft] = useState((order?.etaMinutes || 25) * 60);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // New state variables
  const [statusChangeKey, setStatusChangeKey] = useState(0);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [latestStatusChange, setLatestStatusChange] = useState(null);
  const [statusTimestamps, setStatusTimestamps] = useState({});
  const initialEtaRef = useRef((order?.etaMinutes || 25) * 60);

  const status = trackedOrder?.orderStatus || 'Placed';

  useEffect(() => {
    setTrackedOrder(order);
    const initialSeconds = (order?.etaMinutes || 25) * 60;
    setTimeLeft(initialSeconds);
    initialEtaRef.current = initialSeconds;
    if (order?.orderStatus) {
      setStatusTimestamps(prev => ({ ...prev, [order.orderStatus]: new Date() }));
    }
  }, [order]);

  const handleStatusUpdated = useCallback((payload) => {
    setTrackedOrder((prev) => ({
      ...prev,
      orderStatus: payload.status,
      etaMinutes: payload.etaMinutes ?? prev?.etaMinutes
    }));
    if (payload.etaMinutes) {
      setTimeLeft(payload.etaMinutes * 60);
      initialEtaRef.current = payload.etaMinutes * 60;
    }
    setStatusTimestamps(prev => ({ ...prev, [payload.status]: new Date() }));
    setLatestStatusChange({ status: payload.status, timestamp: new Date() });
    setShowStatusBanner(true);
    setStatusChangeKey(k => k + 1);
    showToast?.(`Your order is now ${payload.status}.`, 'info');
    
    if (payload.status === 'Completed' || payload.status === 'Delivered') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 }, colors: ['#10B981', '#F59E0B', '#E52929', '#6366F1'] });
    }
  }, [showToast]);

  const { isConnected } = useSignalR(trackedOrder?.orderNumber, trackedOrder?.accessToken, handleStatusUpdated);

  // Status banner auto-hide
  useEffect(() => {
    if (!showStatusBanner) return;
    const timer = setTimeout(() => setShowStatusBanner(false), 4000);
    return () => clearTimeout(timer);
  }, [showStatusBanner, statusChangeKey]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status !== 'Out for Delivery' ||
        trackedOrder?.orderType !== 'delivery' ||
        !trackedOrder?.orderNumber) {
      return undefined;
    }

    let isActive = true;
    const refreshEstimate = async () => {
      try {
        const estimate = await refreshOrderEta(trackedOrder.orderNumber, trackedOrder.accessToken);
        if (!isActive || typeof estimate?.etaMinutes !== 'number') return;

        setTrackedOrder((prev) => prev ? { ...prev, etaMinutes: estimate.etaMinutes } : prev);
        setTimeLeft(estimate.etaMinutes * 60);
        initialEtaRef.current = estimate.etaMinutes * 60;
      } catch {
        // ETA refresh is best-effort; SignalR status updates still continue.
      }
    };

    refreshEstimate();
    const intervalId = window.setInterval(refreshEstimate, 150000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [status, trackedOrder?.accessToken, trackedOrder?.orderNumber, trackedOrder?.orderType]);

  const isCancelled = status === 'Cancelled';
  const currentStep = STATUS_STEP[status] || 1;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const canCancel = !isCancelled && (status === 'Placed' || status === 'Preparing');
  const showDeliveryMap = trackedOrder?.orderType === 'delivery' &&
    trackedOrder.deliveryLat &&
    trackedOrder.deliveryLng;
  const deliveryDestination = useMemo(() => showDeliveryMap ? {
    lat: Number(trackedOrder.deliveryLat),
    lng: Number(trackedOrder.deliveryLng)
  } : null, [showDeliveryMap, trackedOrder?.deliveryLat, trackedOrder?.deliveryLng]);

  const statusMessage = useMemo(() => {
    if (isCancelled) return `Reason: ${trackedOrder?.cancellationReason || 'Order was cancelled.'}`;
    return STEPS[Math.max(0, currentStep - 1)]?.msg || 'Your order is being updated.';
  }, [currentStep, isCancelled, trackedOrder]);

  const isCollection = trackedOrder?.orderType === 'collection';
  const progressPercentage = Math.max(0, Math.min(100, ((currentStep - 1) / (STEPS.length - 1)) * 100));

  const getTimerColor = () => {
    if (mins < 2) return 'var(--red)';
    if (mins < 5) return 'var(--amber)';
    return 'var(--green)';
  };
  
  const timerDashArray = 283;
  const initialTotalSeconds = initialEtaRef.current || 1;
  const timerDashOffset = timerDashArray - (timeLeft / initialTotalSeconds) * timerDashArray;
  const isTimerPulsing = mins < 2;

  const currentStepColor = STEPS[Math.max(0, currentStep - 1)]?.color || 'var(--indigo)';

  return (
    <main id="track-order" style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'var(--font-body)', color: 'var(--text)', position: 'relative' }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes subtle-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes pulse-timer {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      {/* Status Change Celebration Overlay */}
      <AnimatePresence mode="wait">
        {showStatusBanner && latestStatusChange && (
          <motion.div
            key={statusChangeKey}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: '-1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              backgroundColor: 'var(--surface)',
              border: `2px solid ${currentStepColor}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'var(--shadow-elevated)'
            }}
          >
            <div style={{ color: currentStepColor, display: 'flex' }}>
              <Info size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', fontFamily: 'var(--font-head)' }}>
                Status Updated
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
                Your order is now <strong>{latestStatusChange.status}</strong>!
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
      >
        {/* Horizontal Progress Stepper */}
        {!isCancelled && (
          <div style={{ width: '100%', padding: '1rem 0', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', left: '0', right: '0', height: '4px', backgroundColor: 'var(--surface-alt)', borderRadius: '2px', zIndex: 0 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', backgroundColor: currentStepColor, borderRadius: '2px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              {STEPS.map((step, index) => {
                const stepNum = index + 1;
                const isDone = stepNum < currentStep;
                const isActive = stepNum === currentStep;
                const isPending = stepNum > currentStep;
                const StepIcon = isCollection && step.status === 'Out for Delivery' ? Store : step.icon;
                const label = isCollection && step.status === 'Out for Delivery' ? 'Ready for Collection' : step.label;
                const stepColor = isDone ? 'var(--green)' : isActive ? step.color : 'var(--text3)';
                const bgColor = isDone || isActive ? stepColor : 'var(--surface)';

                return (
                  <div key={step.status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '25%' }}>
                    <div style={{ position: 'relative' }}>
                      {isActive && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: stepColor, borderRadius: 'var(--radius-full)', animation: 'pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite' }} />
                      )}
                      <div style={{
                        width: '48px', height: '48px', borderRadius: 'var(--radius-full)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: bgColor,
                        color: isDone || isActive ? 'var(--white)' : 'var(--text3)',
                        border: isPending ? '2px solid var(--border)' : `2px solid ${stepColor}`,
                        position: 'relative', zIndex: 2,
                        transition: 'all 0.4s ease'
                      }}>
                        {isDone ? <CheckCircle size={24} /> : <StepIcon size={24} />}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: isActive || isDone ? 700 : 500,
                      color: isActive ? 'var(--text)' : isDone ? 'var(--text2)' : 'var(--text3)',
                      fontSize: '0.9rem', textAlign: 'center', transition: 'color 0.4s ease'
                    }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* LEFT COLUMN */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ color: isCancelled ? 'var(--red)' : 'var(--green)', display: 'inline-flex', marginBottom: '1rem' }}>
                 {isCancelled ? <AlertTriangle size={48} /> : <CheckCircle size={48} />}
              </div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>
                {isCancelled ? 'Order Cancelled' : 'Order Confirmed'}
              </h2>
              <p style={{ color: 'var(--text2)', margin: '0 0 1rem 0' }}>Order #{trackedOrder?.orderNumber || 'RFC-000000'}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                <Clock size={16} />
                {trackedOrder?.orderTime || (trackedOrder?.createdAt ? new Date(trackedOrder.createdAt).toLocaleString('en-GB') : 'Just now')}
              </div>
              {!isCancelled && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{
                    position: 'relative', width: '120px', height: '120px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isTimerPulsing ? 'pulse-timer 1.5s ease-in-out infinite' : 'none'
                  }}>
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-alt)" strokeWidth="6" />
                      <motion.circle
                        cx="50" cy="50" r="45" fill="none"
                        stroke={getTimerColor()} strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={timerDashArray}
                        strokeDashoffset={timerDashOffset}
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                      />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                      <strong style={{ fontSize: '2.2rem', fontFamily: 'var(--font-head)', color: 'var(--text)', lineHeight: 1 }}>
                        {mins}:{secs.toString().padStart(2, '0')}
                      </strong>
                    </div>
                  </div>
                  <span style={{ color: 'var(--text2)', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 500 }}>
                    {isCollection ? 'Estimated collection time' : 'Estimated arrival time'}
                  </span>
                </div>
              )}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem',
                borderRadius: 'var(--radius-full)', fontSize: '0.85rem',
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: isConnected ? 'var(--green)' : 'var(--amber)',
                border: `1px solid ${isConnected ? 'var(--green)' : 'var(--amber)'}`,
                fontWeight: 600,
                animation: !isConnected ? 'subtle-shake 2s ease-in-out infinite' : 'none'
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: isConnected ? 'var(--green)' : 'var(--amber)',
                  animation: isConnected ? 'pulse-timer 2s infinite' : 'none'
                }} />
                {isConnected ? 'Live status connected' : 'Connecting to status...'}
              </div>
            </div>

            <div style={{ backgroundColor: isCancelled ? 'var(--red)' : 'var(--surface)', color: isCancelled ? 'var(--white)' : 'var(--text)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: isCancelled ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 500, fontSize: '1.05rem' }}>
              {statusMessage}
            </div>

            <DeliveryExperience
              destination={deliveryDestination}
              etaMinutes={trackedOrder?.etaMinutes || 25}
              isCollection={isCollection}
            />
          </section>

          {/* MIDDLE COLUMN */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!isCancelled && (
              <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontFamily: 'var(--font-head)', margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Timeline</h3>
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {/* Vertical connecting line */}
                  <div style={{ position: 'absolute', left: '19px', top: '24px', bottom: '24px', width: '2px', backgroundColor: 'var(--surface-alt)', zIndex: 0 }} />
                  
                  <div style={{ position: 'absolute', left: '19px', top: '24px', width: '2px', backgroundColor: 'var(--green)', zIndex: 1, transition: 'height 0.8s ease', height: `${Math.max(0, (currentStep - 1) / (STEPS.length - 1) * 100 - 10)}%` }} />

                  <AnimatePresence mode="popLayout">
                    {STEPS.map((step, index) => {
                      const stepNum = index + 1;
                      const StepIcon = isCollection && step.status === 'Out for Delivery' ? Store : step.icon;
                      const isDone = stepNum < currentStep;
                      const isActive = stepNum === currentStep;
                      const isPending = stepNum > currentStep;
                      const label = isCollection && step.status === 'Out for Delivery' ? 'Ready Soon' : step.label;
                      const timestamp = statusTimestamps[step.status];

                      return (
                        <motion.div
                          key={step.status}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          style={{
                            display: 'flex', gap: '1.25rem', alignItems: 'flex-start',
                            paddingBottom: index === STEPS.length - 1 ? '0' : '2rem',
                            position: 'relative', zIndex: 2,
                            opacity: isPending ? 0.5 : 1
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            {isActive && (
                              <div style={{ position: 'absolute', inset: 0, backgroundColor: step.color, borderRadius: 'var(--radius-full)', animation: 'pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite' }} />
                            )}
                            <div style={{ 
                              width: '40px', height: '40px', borderRadius: 'var(--radius-full)', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              backgroundColor: isDone ? 'var(--green)' : isActive ? step.color : 'var(--surface-alt)',
                              color: isDone || isActive ? 'var(--white)' : 'var(--text3)',
                              position: 'relative', zIndex: 2,
                              transition: 'all 0.4s ease'
                            }}>
                              {isDone ? <CheckCircle size={20} /> : <StepIcon size={20} />}
                            </div>
                          </div>
                          <div style={{ flex: 1, paddingTop: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                              {timestamp && !isPending && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text3)', fontWeight: 500 }}>
                                  {timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text2)' }}>{step.msg}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {trackedOrder && (
              <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontFamily: 'var(--font-head)', margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Order Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem', color: 'var(--text)' }}>
                  <div><strong>Name:</strong> {trackedOrder.customerName}</div>
                  <div><strong>Contact:</strong> {trackedOrder.customerPhone} <br/> <span style={{color: 'var(--text2)', fontSize: '0.85rem'}}>{trackedOrder.customerEmail}</span></div>
                  {trackedOrder.orderType === 'delivery' && (
                    <div><strong>Delivery to:</strong><br/>{trackedOrder.deliveryAddress}<br/>{trackedOrder.deliveryPostcode}</div>
                  )}
                  {trackedOrder.orderType === 'collection' && (
                    <div><strong>Type:</strong> Store Collection</div>
                  )}
                  {trackedOrder.deliveryNotes && (
                    <div><strong>Notes:</strong> {trackedOrder.deliveryNotes}</div>
                  )}
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                    <strong>Payment:</strong> {trackedOrder.paymentMethod === 'cash' ? 'Cash' : 'Card'} ({trackedOrder.paymentStatus})
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT COLUMN */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {trackedOrder && (
              <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-head)', margin: 0, fontSize: '1.25rem' }}>Order Summary</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canCancel && (
                      <button onClick={() => setIsCancelOpen(true)} style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red)', backgroundColor: 'transparent', color: 'var(--red)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        Cancel
                      </button>
                    )}
                    <button onClick={() => setIsPrintOpen(true)} style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--surface-alt)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                      <Printer size={14} /> Receipt
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {trackedOrder.items?.map((item, index) => (
                    <div key={`${item.id || getOrderItemName(item)}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', fontSize: '0.95rem' }}>
                      <span style={{ paddingRight: '1rem' }}>
                        {item.quantity}x {getOrderItemName(item)}
                        {(item.selectedSide || item.selectedDrink || item.options?.length > 0 || item.notes) && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: '0.25rem', marginLeft: '1.25rem' }}>
                            {item.selectedSide && <div>+ {item.selectedSide}</div>}
                            {item.selectedDrink && <div>+ {item.selectedDrink}</div>}
                            {item.options?.map((opt, i) => <div key={i}>+ {opt}</div>)}
                            {item.notes && <div style={{ fontStyle: 'italic' }}>Note: {item.notes}</div>}
                          </div>
                        )}
                      </span>
                      <span style={{ fontWeight: 500 }}>£{(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem', color: 'var(--text2)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>£{trackedOrder.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  {trackedOrder.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green)' }}>
                      <span>Discount {trackedOrder.voucherCode ? `(${trackedOrder.voucherCode})` : ''}</span>
                      <span>-£{trackedOrder.discountAmount?.toFixed(2)}</span>
                    </div>
                  )}
                  {trackedOrder.deliveryFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Delivery Fee</span>
                      <span>£{trackedOrder.deliveryFee?.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem', color: 'var(--text)' }}>
                  <span>Total</span>
                  <span>£{trackedOrder.total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}

            <button onClick={onNewOrder} style={{ padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', boxShadow: 'var(--shadow-sm)' }}>
              <ArrowLeft size={18} /> Back to Menu
            </button>
          </aside>
        </div>
      </motion.div>

      <PrintReceiptModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        order={trackedOrder}
      />

      <CancelOrderModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        order={trackedOrder}
        onConfirmCancel={(orderId, reason) => {
          onCancelOrder?.(orderId, reason);
          setIsCancelOpen(false);
        }}
      />
    </main>
  );
}

function DeliveryExperience({ destination, etaMinutes, isCollection }) {
  if (isCollection || !destination || !googleMapsKey) {
    return (
      <div style={{ backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <FallbackRoute isCollection={isCollection} />
        <p style={{ fontWeight: 600, margin: '1rem 0 0.5rem 0', color: 'var(--text)' }}>{isCollection ? 'Estimated collection: around 15 minutes' : `Estimated arrival: about ${etaMinutes || 25} minutes`}</p>
        <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>{isCollection ? 'We will hold your food hot at the counter.' : 'Route and ETA are estimates, not live driver GPS.'}</span>
      </div>
    );
  }

  return <DeliveryMap destination={destination} etaMinutes={etaMinutes} />;
}

function FallbackRoute({ isCollection }) {
  return (
    <div style={{ position: 'relative', height: '140px', backgroundColor: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 640 230" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        <path d="M35 160 C130 45 230 200 325 112 S505 65 610 155" fill="none" stroke="var(--text)" strokeWidth="4" strokeDasharray="10, 10" />
      </svg>
      <motion.div
        animate={{ x: [ -60, 60, -60 ] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ color: 'var(--indigo)', zIndex: 1, backgroundColor: 'var(--white)', padding: '1rem', borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-md)' }}
      >
        {isCollection ? <Store size={36} /> : <Bike size={36} />}
      </motion.div>
    </div>
  );
}

function DeliveryMap({ destination, etaMinutes }) {
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState('');
  const etaText = etaMinutes ? `Estimated arrival: about ${etaMinutes} minutes` : 'Estimated arrival: about 25 minutes';

  useEffect(() => {
    let isActive = true;
    let directionsRenderer;

    const renderMap = () => {
      if (!isActive || !mapRef.current || !window.google?.maps) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: STORE_LOCATION,
        zoom: 13,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#F8F4EA' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#E6D7B9' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D8ECF4' }] }
        ]
      });
      new window.google.maps.Marker({ position: STORE_LOCATION, map, label: 'RFC' });
      new window.google.maps.Marker({ position: destination, map, label: 'You' });
      const directionsService = new window.google.maps.DirectionsService();
      directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#E8A93F',
          strokeOpacity: 0.95,
          strokeWeight: 5
        }
      });

      directionsService.route({
        origin: STORE_LOCATION,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, routeStatus) => {
        if (routeStatus === 'OK') {
          directionsRenderer.setDirections(result);
        } else {
          setMapError('Route is temporarily unavailable.');
        }
      });
    };

    if (window.google?.maps) {
      renderMap();
    } else {
      const scriptId = 'google-maps-js';
      let script = document.getElementById(scriptId);
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderMap, { once: true });
      script.addEventListener('error', () => setMapError('Map could not be loaded.'), { once: true });
    }

    return () => {
      isActive = false;
      directionsRenderer?.setMap(null);
    };
  }, [destination]);

  if (mapError) {
    return (
      <div style={{ backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <FallbackRoute />
        <p style={{ fontWeight: 600, margin: '1rem 0 0.5rem 0', color: 'var(--text)' }}>{etaText}</p>
        <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>{mapError}</span>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
      <div ref={mapRef} style={{ height: '300px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', backgroundColor: 'var(--surface-alt)' }} />
      <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text)' }}>{etaText}</p>
      <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Estimated route, not live driver GPS.</span>
    </div>
  );
}

OrderTracker.propTypes = {
  order: PropTypes.object,
  onNewOrder: PropTypes.func.isRequired,
  onCancelOrder: PropTypes.func,
  showToast: PropTypes.func
};

DeliveryExperience.propTypes = {
  destination: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
  }),
  etaMinutes: PropTypes.number,
  isCollection: PropTypes.bool
};

FallbackRoute.propTypes = {
  isCollection: PropTypes.bool
};

DeliveryMap.propTypes = {
  destination: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
  }).isRequired,
  etaMinutes: PropTypes.number
};
