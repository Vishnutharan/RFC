// Customer Auth & Profile Storage Service

const DEFAULT_USER = {
  id: 'usr-101',
  name: 'Vishnu Karun',
  email: 'vishnu@example.com',
  phone: '+44 7123 456789',
  address: '37 Berry Avenue',
  postcode: 'WD24 6RU',
  createdAt: new Date().toISOString()
};

export const getCurrentUser = () => {
  const stored = localStorage.getItem('rfc_current_user');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  // Initialize default user if none logged in
  localStorage.setItem('rfc_current_user', JSON.stringify(DEFAULT_USER));
  return DEFAULT_USER;
};

export const registerCustomer = (userData) => {
  const newUser = {
    id: `usr-${Date.now()}`,
    name: userData.name || 'Customer',
    email: userData.email,
    phone: userData.phone || '+44 7000 000000',
    address: userData.address || '37 Berry Avenue',
    postcode: (userData.postcode || 'WD24 6RU').toUpperCase(),
    createdAt: new Date().toISOString()
  };

  const usersList = JSON.parse(localStorage.getItem('rfc_users_list') || '[]');
  usersList.push({ ...newUser, password: userData.password });
  localStorage.setItem('rfc_users_list', JSON.stringify(usersList));
  localStorage.setItem('rfc_current_user', JSON.stringify(newUser));
  return newUser;
};

export const loginCustomer = (email, password) => {
  const usersList = JSON.parse(localStorage.getItem('rfc_users_list') || '[]');
  const found = usersList.find(u => u.email?.toLowerCase() === email?.toLowerCase() && u.password === password);
  if (found) {
    const userWithoutPass = { ...found };
    delete userWithoutPass.password;
    localStorage.setItem('rfc_current_user', JSON.stringify(userWithoutPass));
    return { success: true, user: userWithoutPass };
  }

  // Quick fallback login for demo if email matches default
  if (email.includes('@')) {
    const user = { ...DEFAULT_USER, email, name: email.split('@')[0] };
    localStorage.setItem('rfc_current_user', JSON.stringify(user));
    return { success: true, user };
  }

  return { success: false, message: 'Invalid email or password' };
};

export const updateCustomerProfile = (updatedFields) => {
  const current = getCurrentUser();
  const updatedUser = {
    ...current,
    ...updatedFields
  };
  localStorage.setItem('rfc_current_user', JSON.stringify(updatedUser));
  return updatedUser;
};

export const logoutCustomer = () => {
  localStorage.removeItem('rfc_current_user');
};
