import { MENU_ITEMS, INITIAL_VOUCHERS } from '../data/initialMenu';

const API_BASE_URL = '/api';

export const getMenuItems = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/menu`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn('.NET API offline or connecting, using local menu dataset');
  }
  return MENU_ITEMS;
};

export const validateVoucher = (code, subtotal = 0) => {
  const cleanCode = (code || '').trim().toUpperCase();
  const voucher = INITIAL_VOUCHERS.find(v => v.code === cleanCode);
  
  if (!voucher) {
    return { valid: false, message: 'Invalid voucher code. Try FIRST10 or OVER25' };
  }
  
  if (voucher.minSpend > 0 && subtotal < voucher.minSpend) {
    return { 
      valid: false, 
      message: `Code ${cleanCode} requires minimum spend of £${voucher.minSpend.toFixed(2)}` 
    };
  }

  return {
    valid: true,
    code: cleanCode,
    discountPercent: voucher.discountPercent,
    discountAmount: subtotal > 0 ? (subtotal * voucher.discountPercent) / 100 : 0,
    message: `${voucher.discountPercent}% discount applied!`
  };
};

export const placeOrder = async (orderPayload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('.NET API offline, saving order locally');
  }

  const orderNumber = `RFC-${Math.floor(100000 + Math.random() * 900000)}`;
  const savedOrder = {
    ...orderPayload,
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    orderNumber,
    createdAt: new Date().toISOString(),
    orderStatus: 'Placed',
    paymentStatus: 'Paid'
  };

  const existingOrders = JSON.parse(localStorage.getItem('rfc_orders') || '[]');
  existingOrders.unshift(savedOrder);
  localStorage.setItem('rfc_orders', JSON.stringify(existingOrders));
  return savedOrder;
};

export const getAdminOrders = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/orders`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const local = JSON.parse(localStorage.getItem('rfc_orders') || '[]');
        return [...data, ...local];
      }
    }
  } catch (e) { /* fallback */ }
  return JSON.parse(localStorage.getItem('rfc_orders') || '[]');
};

export const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) return await res.json();
  } catch (e) { /* fallback */ }

  const existingOrders = JSON.parse(localStorage.getItem('rfc_orders') || '[]');
  const updated = existingOrders.map(o => (o.id === orderId || o.orderNumber === orderId) ? { ...o, orderStatus: newStatus } : o);
  localStorage.setItem('rfc_orders', JSON.stringify(updated));
  return { success: true, orderId, orderStatus: newStatus };
};
