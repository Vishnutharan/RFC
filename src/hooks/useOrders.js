import { useCallback, useEffect, useState } from 'react';
import { cancelOrder, placeOrder } from '../services/api';

const RECENT_ORDERS_KEY = 'rfc_recent_orders_session';
const LEGACY_RECENT_ORDERS_KEY = 'rfc_recent_orders';
const ORDER_ACCESS_TOKENS_KEY = 'rfc_order_access_tokens_session';

const getSessionStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const readJson = (key, fallback) => {
  try {
    const raw = getSessionStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    getSessionStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is an optional convenience. Order state remains available in memory.
  }
};

const readAccessTokens = () => {
  const tokens = readJson(ORDER_ACCESS_TOKENS_KEY, {});
  return tokens && typeof tokens === 'object' && !Array.isArray(tokens) ? tokens : {};
};

const readAccessToken = (orderIdOrNumber) => {
  if (!orderIdOrNumber) return undefined;
  const value = readAccessTokens()[String(orderIdOrNumber)];
  return typeof value === 'string' && value ? value : undefined;
};

const storeAccessToken = (orderIdOrNumber, accessToken) => {
  if (!orderIdOrNumber || !accessToken) return;
  writeJson(ORDER_ACCESS_TOKENS_KEY, {
    ...readAccessTokens(),
    [String(orderIdOrNumber)]: accessToken
  });
};

const rememberOrderTokens = (order) => {
  if (!order?.accessToken) return;
  storeAccessToken(order.id, order.accessToken);
  storeAccessToken(order.orderNumber, order.accessToken);
};

const safeOrderForSession = (order) => {
  if (!order || typeof order !== 'object') return null;
  const nonSensitiveOrder = { ...order };
  delete nonSensitiveOrder.accessToken;
  delete nonSensitiveOrder.customerName;
  delete nonSensitiveOrder.customerEmail;
  delete nonSensitiveOrder.customerPhone;
  delete nonSensitiveOrder.deliveryAddress;
  delete nonSensitiveOrder.deliveryPostcode;
  delete nonSensitiveOrder.deliveryNotes;
  delete nonSensitiveOrder.deliveryLat;
  delete nonSensitiveOrder.deliveryLng;
  delete nonSensitiveOrder.cancellationReason;
  delete nonSensitiveOrder.stripePaymentIntentId;
  delete nonSensitiveOrder.checkoutId;
  delete nonSensitiveOrder.driverId;
  return nonSensitiveOrder;
};

const writeRecentOrders = (orders) => {
  writeJson(
    RECENT_ORDERS_KEY,
    orders.map(safeOrderForSession).filter(Boolean).slice(0, 20)
  );
};

const restoreOrderToken = (order) => ({
  ...order,
  accessToken: readAccessToken(order?.id) || readAccessToken(order?.orderNumber)
});

export const useOrders = (showToast) => {
  const [userOrders, setUserOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_RECENT_ORDERS_KEY);
    } catch {
      // Ignore blocked storage while still removing legacy PII where possible.
    }

    const recent = readJson(RECENT_ORDERS_KEY, []);
    setUserOrders(Array.isArray(recent) ? recent.map(restoreOrderToken) : []);
  }, []);

  const rememberAccessToken = useCallback((orderIdOrNumber, accessToken) => {
    storeAccessToken(orderIdOrNumber, accessToken);
  }, []);

  const getAccessToken = useCallback((orderIdOrNumber) => readAccessToken(orderIdOrNumber), []);

  const persistOrder = useCallback((order) => {
    if (!order) return;
    rememberOrderTokens(order);
    setActiveOrder(order);
    setUserOrders((prev) => {
      const next = [order, ...prev.filter((item) => item.id !== order.id && item.orderNumber !== order.orderNumber)].slice(0, 20);
      writeRecentOrders(next);
      return next;
    });
  }, []);

  const clearOrders = useCallback(() => {
    setUserOrders([]);
    setActiveOrder(null);
    try {
      const storage = getSessionStorage();
      storage?.removeItem(RECENT_ORDERS_KEY);
      storage?.removeItem(ORDER_ACCESS_TOKENS_KEY);
    } catch {
      // State has still been cleared even if browser storage is unavailable.
    }
  }, []);

  const submitOrder = useCallback(async (payload) => {
    const savedOrder = await placeOrder(payload);
    persistOrder(savedOrder);
    showToast?.(`Order #${savedOrder.orderNumber} placed successfully.`);
    return savedOrder;
  }, [persistOrder, showToast]);

  const cancelExistingOrder = useCallback(async (orderIdOrNumber, cancellationReason) => {
    const matchedOrder = userOrders.find((order) => order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber) ||
      (activeOrder && (activeOrder.id === orderIdOrNumber || activeOrder.orderNumber === orderIdOrNumber) ? activeOrder : null);
    const accessToken = matchedOrder?.accessToken || readAccessToken(orderIdOrNumber);

    const cancelledOrder = await cancelOrder(orderIdOrNumber, cancellationReason, accessToken);
    const orderWithToken = {
      ...(cancelledOrder || {}),
      accessToken: cancelledOrder?.accessToken || accessToken
    };
    rememberOrderTokens(orderWithToken);

    setUserOrders((prev) => {
      const next = prev.map((order) => (
        order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber
          ? { ...order, ...orderWithToken }
          : order
      ));
      writeRecentOrders(next);
      return next;
    });

    setActiveOrder((prev) => {
      if (!prev || (prev.id !== orderIdOrNumber && prev.orderNumber !== orderIdOrNumber)) return prev;
      return { ...prev, ...orderWithToken };
    });

    showToast?.('Order cancelled successfully.', 'info');
    return orderWithToken;
  }, [activeOrder, showToast, userOrders]);

  return {
    userOrders,
    activeOrder,
    setActiveOrder,
    submitOrder,
    cancelExistingOrder,
    clearOrders,
    getAccessToken,
    rememberAccessToken
  };
};
