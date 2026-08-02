import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowLeft, Bike, CheckCircle, ChefHat, Clock, Home, Printer, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import PrintReceiptModal from './PrintReceiptModal';
import CancelOrderModal from './CancelOrderModal';
import { useSignalR } from '../hooks/useSignalR';
import { refreshOrderEta } from '../services/api';

const STORE_LOCATION = { lat: 51.6742, lng: -0.4085 };
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
    <main id="track-order" className="tracker-container">
      <motion.div
        className="tracker-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="tracker-layout">
          <section>
            <header className="tracker-header">
              <div className={`tracker-status-icon ${isCancelled ? 'cancelled' : ''}`}>
                {isCancelled ? <AlertTriangle size={34} /> : <CheckCircle size={34} />}
              </div>
              <h2>{isCancelled ? 'Order Cancelled' : 'Order Confirmed'}</h2>
              <p>Order #{trackedOrder?.orderNumber || 'RFC-000000'}</p>
              <p className="tracker-time">
                <Clock size={14} />
                {trackedOrder?.orderTime || (trackedOrder?.createdAt ? new Date(trackedOrder.createdAt).toLocaleString('en-GB') : 'Just now')}
              </p>
              {!isCancelled && (
                <div className="eta-block">
                  <strong>{mins}:{secs.toString().padStart(2, '0')}</strong>
                  <span>{trackedOrder?.orderType === 'collection' ? 'Estimated collection time' : 'Estimated arrival time'}</span>
                </div>
              )}
              <span className={`realtime-pill ${isConnected ? 'connected' : ''}`}>
                {isConnected ? 'Status updates connected' : 'Status updates pending'}
              </span>
            </header>

            <div className={`tracker-message ${isCancelled ? 'cancelled' : ''}`}>
              {statusMessage}
            </div>

            <DeliveryExperience
              destination={deliveryDestination}
              etaMinutes={trackedOrder?.etaMinutes || 25}
              isCollection={trackedOrder?.orderType === 'collection'}
            />
          </section>

          <aside>
            {!isCancelled && (
              <div className="status-timeline">
                {STEPS.map((step, index) => {
                  const StepIcon = trackedOrder?.orderType === 'collection' && step.status === 'Out for Delivery' ? Store : step.icon;
                  const isDone = index + 1 < currentStep;
                  const isActive = index + 1 === currentStep;
                  return (
                    <motion.div
                      key={step.status}
                      className={`status-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                    >
                      <div className="step-circle">
                        {isDone ? <CheckCircle size={21} /> : <StepIcon size={20} />}
                      </div>
                      <div>
                        <span className="step-label">{trackedOrder?.orderType === 'collection' && step.status === 'Out for Delivery' ? 'Ready Soon' : step.label}</span>
                        <span className="step-copy">{step.msg}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {trackedOrder && (
              <div className="receipt-section">
                <div className="receipt-header-row">
                  <h4>Order Summary</h4>
                  <div className="receipt-actions">
                    {canCancel && (
                      <button className="btn-soft-danger" type="button" onClick={() => setIsCancelOpen(true)}>
                        Cancel
                      </button>
                    )}
                    <button onClick={() => setIsPrintOpen(true)} className="btn-add-item compact" type="button">
                      <Printer size={14} /> Receipt
                    </button>
                  </div>
                </div>

                {trackedOrder.items?.map((item, index) => (
                  <div key={`${item.id || getOrderItemName(item)}-${index}`} className="receipt-row">
                    <span>{item.quantity}x {getOrderItemName(item)}</span>
                    <span>GBP {(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}

                <div className="receipt-total-row">
                  <span>Total</span>
                  <span>GBP {trackedOrder.total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}

            <button onClick={onNewOrder} className="tracker-back-btn" type="button">
              <ArrowLeft size={16} /> Back to Menu
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
      <div className="delivery-map-panel fallback">
        <FallbackRoute isCollection={isCollection} />
        <p>{isCollection ? 'Estimated collection: around 15 minutes' : `Estimated arrival: about ${etaMinutes || 25} minutes`}</p>
        <span>{isCollection ? 'We will hold your food hot at the counter.' : 'Route and ETA are estimates, not live driver GPS.'}</span>
      </div>
    );
  }

  return <DeliveryMap destination={destination} etaMinutes={etaMinutes} />;
}

function FallbackRoute({ isCollection }) {
  return (
    <div className="fallback-route" aria-label={isCollection ? 'Collection progress' : 'Delivery route'}>
      <svg viewBox="0 0 640 230" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-dash" d="M35 160 C130 45 230 200 325 112 S505 65 610 155" />
      </svg>
      <div className="scooter">
        {isCollection ? <Store size={30} /> : <Bike size={32} />}
      </div>
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

    // TODO: Real driver GPS is not implemented. Add driver lat/lng posting,
    // a DriverLocation table or cache, and SignalR location broadcasts before
    // presenting this as live driver movement.
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
      <div className="delivery-map-panel fallback">
        <FallbackRoute />
        <p>{etaText}</p>
        <span>{mapError}</span>
      </div>
    );
  }

  return (
    <div className="delivery-map-panel">
      <div ref={mapRef} className="delivery-map" />
      <p>{etaText}</p>
      <span>Estimated route, not live driver GPS.</span>
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
