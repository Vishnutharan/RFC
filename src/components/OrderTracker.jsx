import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowLeft, Bike, CheckCircle, ChefHat, Clock, Home, Printer, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import PrintReceiptModal from './PrintReceiptModal';
import CancelOrderModal from './CancelOrderModal';
import { useSignalR } from '../hooks/useSignalR';
import { refreshOrderEta } from '../services/api';

const STORE_LOCATION = { lat: 51.682366, lng: -0.41867 };
const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const STEPS = [
  { label: 'Order Placed', status: 'Placed', icon: CheckCircle, msg: 'We have received your order and sent it to the kitchen.' },
  { label: 'In Kitchen', status: 'Preparing', icon: ChefHat, msg: 'Chef Tharan is preparing your food fresh.' },
  { label: 'On Its Way', status: 'Out for Delivery', icon: Bike, msg: 'Estimated delivery time is being refreshed from the store route.' },
  { label: 'Delivered', status: 'Completed', icon: Home, msg: 'Enjoy your meal while it is hot.' }
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

  const status = trackedOrder?.orderStatus || 'Placed';

  useEffect(() => {
    setTrackedOrder(order);
    setTimeLeft((order?.etaMinutes || 25) * 60);
  }, [order]);

  const handleStatusUpdated = useCallback((payload) => {
    setTrackedOrder((prev) => ({
      ...prev,
      orderStatus: payload.status,
      etaMinutes: payload.etaMinutes ?? prev?.etaMinutes
    }));
    if (payload.etaMinutes) setTimeLeft(payload.etaMinutes * 60);
    showToast?.(`Your order is now ${payload.status}.`, 'info');
  }, [showToast]);

  const { isConnected } = useSignalR(trackedOrder?.orderNumber, trackedOrder?.accessToken, handleStatusUpdated);

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

  return (
    <main id="track-order" style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'var(--font-body)', color: 'var(--text)' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}
      >
        <section style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              <div style={{ padding: '1rem', backgroundColor: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '2.5rem', fontFamily: 'var(--font-head)', color: 'var(--text)', lineHeight: 1 }}>{mins}:{secs.toString().padStart(2, '0')}</strong>
                <span style={{ color: 'var(--text2)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{trackedOrder?.orderType === 'collection' ? 'Estimated collection time' : 'Estimated arrival time'}</span>
              </div>
            )}
            <div style={{ display: 'inline-block', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', backgroundColor: isConnected ? 'var(--green)' : 'var(--amber)', color: 'var(--white)', fontWeight: 600 }}>
              {isConnected ? 'Status updates connected' : 'Status updates pending'}
            </div>
          </div>

          <div style={{ backgroundColor: isCancelled ? 'var(--red)' : 'var(--surface)', color: isCancelled ? 'var(--white)' : 'var(--text)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: isCancelled ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 500, fontSize: '1.05rem' }}>
            {statusMessage}
          </div>

          <DeliveryExperience
            destination={deliveryDestination}
            etaMinutes={trackedOrder?.etaMinutes || 25}
            isCollection={trackedOrder?.orderType === 'collection'}
          />
        </section>

        <aside style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!isCancelled && (
            <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-head)', margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Order Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {STEPS.map((step, index) => {
                  const StepIcon = trackedOrder?.orderType === 'collection' && step.status === 'Out for Delivery' ? Store : step.icon;
                  const isDone = index + 1 < currentStep;
                  const isActive = index + 1 === currentStep;
                  const isPending = index + 1 > currentStep;
                  
                  return (
                    <motion.div
                      key={step.status}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                      style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', opacity: isPending ? 0.5 : 1 }}
                    >
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: 'var(--radius-full)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        backgroundColor: isDone ? 'var(--green)' : isActive ? 'var(--indigo)' : 'var(--surface-alt)',
                        color: isDone || isActive ? 'var(--white)' : 'var(--text3)'
                      }}>
                        {isDone ? <CheckCircle size={20} /> : <StepIcon size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>{trackedOrder?.orderType === 'collection' && step.status === 'Out for Delivery' ? 'Ready Soon' : step.label}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text2)' }}>{step.msg}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {trackedOrder && (
            <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-head)', margin: 0, fontSize: '1.25rem' }}>Order Summary</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {canCancel && (
                    <button onClick={() => setIsCancelOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red)', backgroundColor: 'transparent', color: 'var(--red)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Cancel
                    </button>
                  )}
                  <button onClick={() => setIsPrintOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--surface-alt)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Printer size={16} /> Receipt
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                {trackedOrder.items?.map((item, index) => (
                  <div key={`${item.id || getOrderItemName(item)}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)' }}>
                    <span>{item.quantity}x {getOrderItemName(item)}</span>
                    <span style={{ fontWeight: 500 }}>£{(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
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
