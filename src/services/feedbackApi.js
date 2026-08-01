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

export const getReviewsAndComplaints = async () => {
  return requestJson('/reviews', { method: 'GET', headers: {} });
};

export const addReviewOrComplaint = async (feedback) => {
  return requestJson('/reviews', {
    method: 'POST',
    body: JSON.stringify(feedback)
  });
};

export const updateFeedbackStatus = async (id, newStatus, managerResponse = null) => {
  return requestJson(`/reviews/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: newStatus,
      response: managerResponse
    })
  });
};
