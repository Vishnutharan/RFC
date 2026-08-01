import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowLeft, Bike, CheckCircle, ChefHat, Clock, Home, Printer } from 'lucide-react';
import PrintReceiptModal from './PrintReceiptModal';
import CancelOrderModal from './CancelOrderModal';
import { useSignalR } from '../hooks/useSignalR';

const STORE_LOCATION = { lat: 51.6742, lng: -0.4085 };
const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const STEPS = [
  { label: 'Order Placed', status: 'Placed', icon: CheckCircle, msg: 'Your order has been received.' },
  { label: 'In Kitchen', status: 'Preparing', icon: ChefHat, msg: 'Our team is preparing your food.' },
  { label: 'On Its Way', status: 'Out for Delivery', icon: Bike, msg: 'Your order is on its way.' },
  { label: 'Delivered', status: 'Completed', icon: Home, msg: 'Enjoy your meal.' }
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
  const [timeLeft, setTimeLeft] = useState((order?.etaMinutes || 55) * 60);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  useEffect(() => {
    setTrackedOrder(order);
    setTimeLeft((order?.etaMinutes || 55) * 60);
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

  const { isConnected } = useSignalR(trackedOrder?.orderNumber, handleStatusUpdated);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = trackedOrder?.orderStatus || 'Placed';
  const isCancelled = status === 'Cancelled';
  const currentStep = STATUS_STEP[status] || 1;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const canCancel = !isCancelled && (status === 'Placed' || status === 'Preparing');
  const showDeliveryMap = trackedOrder?.orderType === 'delivery' &&
    status === 'Out for Delivery' &&
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
    <div className="tracker-container">
      <div className="tracker-card">
        <header className="tracker-header">
          <div className={`tracker-status-icon ${isCancelled ? 'cancelled' : ''}`}>
            {isCancelled ? <AlertTriangle size={42} /> : <CheckCircle size={42} />}
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
              <span>{trackedOrder?.orderType === 'collection' ? 'Estimated collection time' : 'Estimated delivery time'}</span>
            </div>
          )}
          <span className={`realtime-pill ${isConnected ? 'connected' : ''}`}>
            {isConnected ? 'Live updates on' : 'Live updates pending'}
          </span>
        </header>

        {!isCancelled && (
          <div className="status-timeline">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isDone = index + 1 < currentStep;
              const isActive = index + 1 === currentStep;
              return (
                <div key={step.status} className={`status-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                  <div className="step-circle">
                    {isDone ? <CheckCircle size={20} /> : <StepIcon size={18} />}
                  </div>
                  <span className="step-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`tracker-message ${isCancelled ? 'cancelled' : ''}`}>
          <p>{statusMessage}</p>
        </div>

        {showDeliveryMap && (
          <DeliveryMap
            destination={deliveryDestination}
            etaMinutes={trackedOrder.etaMinutes}
          />
        )}

        {trackedOrder && (
          <div className="receipt-section">
            <div className="receipt-header-row">
              <h4>Order Summary</h4>
              <div className="receipt-actions">
                {canCancel && (
                  <button className="btn-soft-danger" onClick={() => setIsCancelOpen(true)}>
                    Cancel Order
                  </button>
                )}
                <button onClick={() => setIsPrintOpen(true)} className="btn-add-item compact">
                  <Printer size={14} /> Print Receipt
                </button>
              </div>
            </div>

            {trackedOrder.items?.map((item, index) => (
              <div key={`${item.id}-${index}`} className="receipt-row">
                <span>{item.quantity}x {getOrderItemName(item)}</span>
                <span>GBP {(getOrderItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div className="receipt-total-row">
              <span>Total Amount</span>
              <span>GBP {trackedOrder.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        )}

        <button onClick={onNewOrder} className="tracker-back-btn">
          <ArrowLeft size={16} /> Back to Menu
        </button>
      </div>

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
    </div>
  );
}

function DeliveryMap({ destination, etaMinutes }) {
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!googleMapsKey) {
      setMapError('Google Maps key is not configured.');
      return undefined;
    }

    let isActive = true;
    let directionsRenderer;

    const renderMap = () => {
      if (!isActive || !mapRef.current || !window.google?.maps) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: STORE_LOCATION,
        zoom: 13,
        disableDefaultUI: true
      });
      const directionsService = new window.google.maps.DirectionsService();
      directionsRenderer = new window.google.maps.DirectionsRenderer({ map, suppressMarkers: false });

      directionsService.route({
        origin: STORE_LOCATION,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === 'OK') {
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
    }

    return () => {
      isActive = false;
      directionsRenderer?.setMap(null);
    };
  }, [destination]);

  return (
    <div className="delivery-map-panel">
      <div ref={mapRef} className="delivery-map" />
      <p>{etaMinutes ? `Estimated arrival in ~${etaMinutes} minutes` : 'Estimated arrival is being calculated.'}</p>
      {mapError && <span>{mapError}</span>}
    </div>
  );
}

OrderTracker.propTypes = {
  order: PropTypes.object,
  onNewOrder: PropTypes.func.isRequired,
  onCancelOrder: PropTypes.func,
  showToast: PropTypes.func
};

DeliveryMap.propTypes = {
  destination: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
  }).isRequired,
  etaMinutes: PropTypes.number
};
