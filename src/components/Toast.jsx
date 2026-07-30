import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastItem = ({ id, message, type = 'info', onDismiss, duration = 4000 }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      // Wait for the exit animation to finish before removing from state
      setTimeout(() => onDismiss(id), 400); 
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onDismiss(id), 400);
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={24} />;
      case 'error': return <AlertCircle size={24} />;
      case 'info':
      default: return <Info size={24} />;
    }
  };

  return (
    <div className={`toast toast-${type} ${isClosing ? 'closing' : ''}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-content">
        <p>{message}</p>
      </div>
      <button className="toast-close" onClick={handleClose} aria-label="Dismiss">
        <X size={16} />
      </button>
      <div 
        className="toast-progress" 
        style={{ animationDuration: `${duration}ms` }} 
      />
    </div>
  );
};

const Toast = ({ toasts, dismissToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onDismiss={dismissToast}
        />
      ))}
    </div>
  );
};

export default Toast;
