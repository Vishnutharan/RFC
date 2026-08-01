import { INITIAL_VOUCHERS } from '../data/initialMenu';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const CSRF_COOKIE = 'rfc_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const readCookie = (name) => {
  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
};

const readErrorMessage = async (res) => {
  try {
    const body = await res.json();
    return body?.message || body?.title || res.statusText;
  } catch {
    return res.statusText;
  }
};

const ensureCsrfToken = async () => {
  let token = readCookie(CSRF_COOKIE);
  if (token) return token;

  await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include'
  });

  token = readCookie(CSRF_COOKIE);
  return token;
};

export const getHubUrl = () => {
  if (API_BASE_URL.endsWith('/api')) return API_BASE_URL.slice(0, -4) + '/hubs/order';
  if (API_BASE_URL === '/api') return '/hubs/order';
  return `${API_BASE_URL.replace(/\/$/, '')}/hubs/order`;
};

export const requestJson = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) headers[CSRF_HEADER] = csrfToken;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    method,
    headers
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  if (res.status === 204) return null;
  return res.json();
};

export const getMenuItems = async () => requestJson('/menu');

export const validateVoucher = (code, subtotal = 0) => {
  const cleanCode = (code || '').trim().toUpperCase();
  const voucher = INITIAL_VOUCHERS.find((v) => v.code === cleanCode);

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
    message: `${voucher.discountPercent}% discount applied`
  };
};

export const placeOrder = async (orderPayload) => {
  return requestJson('/orders', {
    method: 'POST',
    body: JSON.stringify(orderPayload)
  });
};

export const getOrder = async (orderIdOrNumber) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}`);
};

export const cancelOrder = async (orderIdOrNumber, reason) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  });
};

export const getAdminOrders = async () => {
  return requestJson('/admin/orders');
};

export const updateOrderStatus = async (orderId, newStatus) => {
  return requestJson(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
};

export const createPaymentIntent = async ({ amount, customerEmail }) => {
  return requestJson('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ amount, customerEmail })
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
  return requestJson('/auth/me');
};

export const deleteCurrentCustomer = async () => {
  return requestJson('/auth/customers/me', { method: 'DELETE' });
};
