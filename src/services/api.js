import { INITIAL_VOUCHERS } from '../data/initialMenu';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const CSRF_COOKIE = 'rfc_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const ORDER_ACCESS_HEADER = 'X-Order-Access-Token';
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

export const getPublicConfig = async () => requestJson('/config/public');

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

const orderAccessOptions = (accessToken) => (
  accessToken ? { headers: { [ORDER_ACCESS_HEADER]: accessToken } } : {}
);

export const getOrder = async (orderIdOrNumber, accessToken) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}`, orderAccessOptions(accessToken));
};

export const refreshOrderEta = async (orderIdOrNumber, accessToken) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}/eta`, orderAccessOptions(accessToken));
};

export const cancelOrder = async (orderIdOrNumber, reason, accessToken) => {
  return requestJson(`/orders/${encodeURIComponent(orderIdOrNumber)}/cancel`, {
    method: 'PUT',
    headers: orderAccessOptions(accessToken).headers,
    body: JSON.stringify({ reason })
  });
};

export const getAdminOrders = async () => {
  return requestJson('/admin/orders');
};

export const getAdminMenu = async () => {
  return requestJson('/admin/menu');
};

export const createAdminMenuItem = async (menuItem) => {
  return requestJson('/admin/menu', {
    method: 'POST',
    body: JSON.stringify(menuItem)
  });
};

export const updateAdminMenuItem = async (menuItemId, menuItem) => {
  return requestJson(`/admin/menu/${encodeURIComponent(menuItemId)}`, {
    method: 'PUT',
    body: JSON.stringify(menuItem)
  });
};

export const archiveAdminMenuItem = async (menuItemId) => {
  return requestJson(`/admin/menu/${encodeURIComponent(menuItemId)}`, {
    method: 'DELETE'
  });
};

export const getAdminCustomers = async () => {
  return requestJson('/admin/customers');
};

export const getAdminStaff = async () => {
  return requestJson('/admin/staff');
};

export const createAdminStaff = async (staffUser) => {
  return requestJson('/admin/staff', {
    method: 'POST',
    body: JSON.stringify(staffUser)
  });
};

export const updateAdminStaff = async (staffUserId, staffUser) => {
  return requestJson(`/admin/staff/${encodeURIComponent(staffUserId)}`, {
    method: 'PUT',
    body: JSON.stringify(staffUser)
  });
};

export const getAdminAuditLogs = async () => {
  return requestJson('/admin/audit');
};

export const getAdminSettings = async () => {
  return requestJson('/admin/settings');
};

export const updateAdminSetting = async (key, value) => {
  return requestJson(`/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  });
};

export const updateOrderStatus = async (orderId, newStatus) => {
  return requestJson(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus })
  });
};

export const createPaymentIntent = async ({ checkoutId, order }) => {
  return requestJson('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ checkoutId, order })
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
