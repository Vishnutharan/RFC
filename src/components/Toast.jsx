import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, CheckCircle, Info, TriangleAlert, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info
};

function ToastItem({ id, message, type = 'info', onDismiss, duration = 4000 }) {
  const [isClosing, setIsClosing] = useState(false);
  const Icon = icons[type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => onDismiss(id), 320);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onDismiss(id), 320);
  };

  return (
    <div className={`toast toast-${type} ${isClosing ? 'closing' : ''}`}>
      <div className="toast-icon">
        <Icon size={23} />
      </div>
      <div className="toast-content">
        <p>{message}</p>
      </div>
      <button className="toast-close" type="button" onClick={handleClose} aria-label="Dismiss notification">
        <X size={16} />
      </button>
      <div className="toast-progress" style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
}

export default function Toast({ toasts, dismissToast }) {
  if (!toasts || toasts.length === 0) return null;
  const onDismiss = dismissToast || (() => {});

  return (
    <div className="toast-container">
      {toasts.slice(-3).map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

ToastItem.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  onDismiss: PropTypes.func.isRequired,
  duration: PropTypes.number
};

Toast.propTypes = {
  toasts: PropTypes.array,
  dismissToast: PropTypes.func
};
