import { useCallback, useEffect, useState } from 'react';
import { cancelOrder, placeOrder } from '../services/api';

const RECENT_ORDERS_KEY = 'rfc_recent_orders';

export const useOrders = (showToast) => {
  const [userOrders, setUserOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_ORDERS_KEY) || '[]');
      setUserOrders(Array.isArray(recent) ? recent : []);
    } catch {
      setUserOrders([]);
    }
  }, []);

  const persistOrder = useCallback((order) => {
    setActiveOrder(order);
    setUserOrders((prev) => {
      const next = [order, ...prev.filter((item) => item.id !== order.id)].slice(0, 20);
      localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const submitOrder = useCallback(async (payload) => {
    const savedOrder = await placeOrder(payload);
    persistOrder(savedOrder);
    showToast?.(`Order #${savedOrder.orderNumber} placed successfully.`);
    return savedOrder;
  }, [persistOrder, showToast]);

  const cancelExistingOrder = useCallback(async (orderIdOrNumber, cancellationReason) => {
    setUserOrders((prev) => prev.map((order) => {
      if (order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber) {
        return { ...order, orderStatus: 'Cancelled', cancellationReason };
      }
      return order;
    }));

    setActiveOrder((prev) => {
      if (!prev || (prev.id !== orderIdOrNumber && prev.orderNumber !== orderIdOrNumber)) return prev;
      return { ...prev, orderStatus: 'Cancelled', cancellationReason };
    });

    await cancelOrder(orderIdOrNumber, cancellationReason);
    showToast?.('Order cancelled successfully.', 'info');
  }, [showToast]);

  return {
    userOrders,
    activeOrder,
    setActiveOrder,
    submitOrder,
    cancelExistingOrder
  };
};
