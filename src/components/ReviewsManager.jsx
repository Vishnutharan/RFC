import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Filter, MessageSquare, Send, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { addReviewOrComplaint, getReviewsAndComplaints, updateFeedbackStatus } from '../services/feedbackApi';

const filters = ['All', '5 Stars', '4 Stars', 'With Photos', 'With Replies', 'Complaints'];

export default function ReviewsManager({ isAdmin = false, showToast }) {
  const [items, setItems] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [activeRespondId, setActiveRespondId] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    rating: 5,
    type: 'Review',
    category: 'Food Quality',
    comment: '',
    orderNumber: ''
  });

  const loadData = async () => {
    try {
      const data = await getReviewsAndComplaints();
      setItems(data || []);
    } catch (error) {
      setItems([]);
      showToast?.(error.message || 'Feedback could not be loaded.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const avgRating = items.length
    ? (items.reduce((sum, item) => sum + Number(item.rating || 5), 0) / items.length).toFixed(1)
    : '5.0';
  const pendingComplaintsCount = items.filter((item) => item.type === 'Complaint' && item.status === 'Pending').length;

  const filtered = useMemo(() => items.filter((item) => {
    if (filterType === '5 Stars') return Number(item.rating || 0) === 5;
    if (filterType === '4 Stars') return Number(item.rating || 0) === 4;
    if (filterType === 'With Photos') return Boolean(item.photoUrl || item.imageUrl);
    if (filterType === 'With Replies') return Boolean(item.response);
    if (filterType === 'Complaints') return item.type === 'Complaint';
    return true;
  }), [filterType, items]);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!form.comment.trim()) return;

    try {
      await addReviewOrComplaint(form);
      setForm({
        customerName: '',
        rating: 5,
        type: 'Review',
        category: 'Food Quality',
        comment: '',
        orderNumber: ''
      });
      await loadData();
      showToast?.(form.type === 'Complaint' ? 'Complaint submitted. A manager will respond shortly.' : 'Thank you for your review.');
    } catch (error) {
      showToast?.(error.message || 'Feedback could not be submitted.', 'error');
    }
  };

  const handleAdminRespond = async (id, newStatus = 'Resolved') => {
    try {
      await updateFeedbackStatus(id, newStatus, responseText);
      setActiveRespondId(null);
      setResponseText('');
      await loadData();
      showToast?.('Feedback response updated.');
    } catch (error) {
      showToast?.(error.message || 'Feedback status could not be updated.', 'error');
    }
  };

  return (
    <div id="reviews" className="reviews-shell">
      <section className="reviews-summary">
        <div>
          <h3>
            <Star color="var(--color-accent-primary)" fill="var(--color-accent-primary)" size={24} />
            {' '}{avgRating} / 5.0 Rating
          </h3>
          <p className="modal-subtitle">
            {items.length} verified reviews - {pendingComplaintsCount} pending complaint{pendingComplaintsCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="filter-tabs">
          {filters.map((filter) => (
            <button
              key={filter}
              className={`filter-tab ${filterType === filter ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType(filter)}
            >
              <Filter size={14} /> {filter}
            </button>
          ))}
        </div>
      </section>

      {!isAdmin && (
        <form className="reviews-form dashboard-card" onSubmit={handleFormSubmit}>
          <h4>Leave a review or report an issue</h4>
          <div className="checkout-grid">
            <label className="input-group">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="Review">Positive review</option>
                <option value="Complaint">Complaint / issue</option>
              </select>
            </label>
            <label className="input-group">
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                <option value="Food Quality">Food quality</option>
                <option value="Delivery Speed">Delivery speed</option>
                <option value="Missing Item">Missing item</option>
                <option value="Customer Support">Customer support</option>
              </select>
            </label>
            <div className="stars" aria-label={`${form.rating} star rating`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setForm({ ...form, rating: star })} aria-label={`${star} stars`}>
                  <Star size={22} fill={star <= form.rating ? 'currentColor' : 'transparent'} />
                </button>
              ))}
            </div>
          </div>

          <div className="checkout-address-grid" style={{ marginTop: 10 }}>
            <label className="input-group">
              <input
                type="text"
                placeholder="Your name"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
              />
            </label>
            <label className="input-group">
              <input
                type="text"
                placeholder="Order number"
                value={form.orderNumber}
                onChange={(event) => setForm({ ...form, orderNumber: event.target.value })}
              />
            </label>
          </div>

          <textarea
            className="notes-input"
            placeholder={form.type === 'Complaint' ? 'Tell us what went wrong...' : 'Tell Watford what you loved...'}
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.target.value })}
            style={{ marginTop: 10 }}
          />

          <button type="submit" className="btn-submit-modal" style={{ marginTop: 12, width: 'auto' }}>
            <Send size={16} /> Submit {form.type}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="empty-state">No feedback found in this category.</p>
      ) : (
        <div className="review-grid">
          {filtered.map((item, index) => (
            <motion.article
              key={item.id || index}
              className="review-card"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(index, 8) * 0.04 }}
            >
              <div className="review-meta-row">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="avatar-initial">{(item.customerName || 'R').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{item.customerName || 'RFC customer'}</strong>
                    <p className="cart-line-meta">{item.date ? new Date(item.date).toLocaleDateString() : 'Recent'} - {item.category}</p>
                  </div>
                </div>
                <span className={`status-badge ${item.type === 'Complaint' ? 'status-cancelled' : 'status-completed'}`}>
                  {item.type}
                </span>
              </div>

              <div className="stars">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star key={starIndex} size={15} fill={starIndex < Number(item.rating || 5) ? 'currentColor' : 'transparent'} />
                ))}
              </div>

              {(item.photoUrl || item.imageUrl) && (
                <img className="item-modal-image" src={item.photoUrl || item.imageUrl} alt="Customer submitted food review" loading="lazy" />
              )}

              <p>{item.comment}</p>

              {item.response && (
                <div className="manager-response">
                  <strong>Store manager response</strong>
                  <p>{item.response}</p>
                </div>
              )}

              {isAdmin && (
                <div className="admin-response-row">
                  {activeRespondId === item.id ? (
                    <div className="voucher-input-group">
                      <MessageSquare size={16} />
                      <input
                        type="text"
                        placeholder="Write manager reply or voucher code..."
                        value={responseText}
                        onChange={(event) => setResponseText(event.target.value)}
                      />
                      <button className="btn-apply-voucher" type="button" onClick={() => handleAdminRespond(item.id)}>
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-add-item compact"
                      type="button"
                      onClick={() => {
                        setActiveRespondId(item.id);
                        setResponseText(item.response || '');
                      }}
                    >
                      <MessageSquare size={14} /> {item.response ? 'Edit reply' : 'Reply'}
                    </button>
                  )}
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}

ReviewsManager.propTypes = {
  isAdmin: PropTypes.bool,
  showToast: PropTypes.func
};
