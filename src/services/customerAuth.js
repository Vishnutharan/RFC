import { requestJson } from './api';

export const getCurrentUser = async () => {
  const session = await requestJson('/auth/me');
  return session?.role === 'customer' ? session : null;
};

export const registerCustomer = async (userData) => {
  return requestJson('/auth/customers/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
};

export const loginCustomer = async (email, password) => {
  const user = await requestJson('/auth/customers/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  return { success: true, user };
};

export const updateCustomerProfile = async (updatedFields) => {
  return requestJson('/auth/customers/me', {
    method: 'PUT',
    body: JSON.stringify(updatedFields)
  });
};

export const getCustomerOrders = async (page = 1, pageSize = 20) => {
  return requestJson(`/auth/customers/me/orders?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`);
};

export const logoutCustomer = async () => {
  await requestJson('/auth/logout', { method: 'POST', body: '{}' });
};
