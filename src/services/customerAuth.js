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

export const getCurrentUser = async () => {
  const session = await requestJson('/auth/me', { method: 'GET', headers: {} });
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

export const logoutCustomer = async () => {
  await requestJson('/auth/logout', { method: 'POST', body: '{}' });
};
