import { MENU_ITEMS, INITIAL_VOUCHERS } from '../data/initialMenu';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const readErrorMessage = async (res) => {
  try {
    const body = await res.json();
    return body?.message || body?.title || res.statusText;
  } catch {
    return res.statusText;
  }
};

const requestJson = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  if (res.status === 204) return null;
  return res.json();
};

export const getMenuItems = async () => {
  try {
    const data = await requestJson('/menu', { method: 'GET', headers: {} });
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (e) {
    console.warn('.NET API menu unavailable, using local menu dataset');
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
      message: `Code ${cleanCode} requires minimum spend of GBP ${voucher.minSpend.toFixed(2)}`
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
  return requestJson('/orders', {
    method: 'POST',
    body: JSON.stringify(orderPayload)
  });
};

export const cancelOrder = async (orderIdOrNumber, reason) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  });
};

export const getAdminOrders = async () => {
  return requestJson('/admin/orders', { method: 'GET', headers: {} });
};

export const updateOrderStatus = async (orderId, newStatus) => {
  return requestJson(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
};

export const adminLogin = async (email, password) => {
  return requestJson('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
};

export const logoutSession = async () => {
  return requestJson('/auth/logout', { method: 'POST', body: '{}' });
};

export const getCurrentSession = async () => {
  return requestJson('/auth/me', { method: 'GET', headers: {} });
};
