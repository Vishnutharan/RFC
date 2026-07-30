// Reviews & Complaints Service for RFC Watford

const INITIAL_REVIEWS = [
  {
    id: 'rev-1',
    customerName: 'Sarah M.',
    rating: 5,
    type: 'Review',
    category: 'Food Quality',
    comment: 'The 10-piece bucket was super crispy and piping hot! Delivered in 25 mins. Best chicken in Watford!',
    date: '2026-07-29T18:30:00Z',
    status: 'Published',
    response: 'Thank you Sarah! Glad you loved the extra crispy recipe! 🍗'
  },
  {
    id: 'rev-2',
    customerName: 'David K.',
    rating: 5,
    type: 'Review',
    category: 'Delivery Speed',
    comment: 'Always fast delivery to Berry Avenue. Free delivery code worked perfectly!',
    date: '2026-07-28T19:15:00Z',
    status: 'Published',
    response: null
  },
  {
    id: 'rev-3',
    customerName: 'James P.',
    rating: 2,
    type: 'Complaint',
    category: 'Missing Item',
    comment: 'Ordered 2 Large Fries with my Box Meal but only received 1. Please check kitchen packaging.',
    date: '2026-07-27T14:10:00Z',
    status: 'Resolved',
    response: 'Apologies James! We have issued a £5 credit voucher to your account for the missing fries.'
  }
];

export const getReviewsAndComplaints = () => {
  const stored = localStorage.getItem('rfc_reviews');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  localStorage.setItem('rfc_reviews', JSON.stringify(INITIAL_REVIEWS));
  return INITIAL_REVIEWS;
};

export const addReviewOrComplaint = (feedback) => {
  const current = getReviewsAndComplaints();
  const newEntry = {
    id: `rev-${Date.now()}`,
    customerName: feedback.customerName || 'Anonymous Customer',
    rating: Number(feedback.rating) || 5,
    type: feedback.type || 'Review', // 'Review' or 'Complaint'
    category: feedback.category || 'General',
    comment: feedback.comment || '',
    orderNumber: feedback.orderNumber || null,
    date: new Date().toISOString(),
    status: feedback.type === 'Complaint' ? 'Pending' : 'Published',
    response: null
  };
  const updated = [newEntry, ...current];
  localStorage.setItem('rfc_reviews', JSON.stringify(updated));
  return newEntry;
};

export const updateFeedbackStatus = (id, newStatus, managerResponse = null) => {
  const current = getReviewsAndComplaints();
  const updated = current.map(item => {
    if (item.id === id) {
      return {
        ...item,
        status: newStatus,
        response: managerResponse !== null ? managerResponse : item.response
      };
    }
    return item;
  });
  localStorage.setItem('rfc_reviews', JSON.stringify(updated));
  return updated;
};
