import { requestJson } from './api';

export const getReviewsAndComplaints = async () => {
  return requestJson('/reviews');
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
