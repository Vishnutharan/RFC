import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Filter, MessageSquare, Send, Star, CheckCircle, AlertTriangle, User, Hash, Tag, ThumbsUp } from 'lucide-react';
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

  const loadData = useCallback(async () => {
    try {
      const data = await getReviewsAndComplaints();
      setItems(data || []);
    } catch (error) {
      setItems([]);
      showToast?.(error.message || 'Feedback could not be loaded.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <div id="reviews" className="reviews-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary Header & Filters Banner */}
      <section style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--amber)',
            flexShrink: 0
          }}>
            <Star fill="var(--amber)" color="var(--amber)" size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                {avgRating}
              </h3>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text2)' }}>/ 5.0 Rating</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text3)', margin: '4px 0 0 0', fontWeight: 500 }}>
              {items.length} verified customer reviews &bull; {pendingComplaintsCount} pending complaint{pendingComplaintsCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {filters.map((filter) => (
            <button
              key={filter}
              className={`cat-tab ${filterType === filter ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType(filter)}
            >
              <Filter size={13} /> {filter}
            </button>
          ))}
        </div>
      </section>

      {/* Customer Submission Form (when !isAdmin) */}
      {!isAdmin && (
        <form
          className="reviews-form"
          onSubmit={handleFormSubmit}
          style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Leave Feedback or Report an Issue
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text3)', margin: '4px 0 0 0' }}>
              We value your experience at RFC Watford. Share your review or let us resolve any issue.
            </p>
          </div>

          {/* Type Switcher Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className={`mode-btn ${form.type === 'Review' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, type: 'Review' })}
              style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
            >
              <ThumbsUp size={16} /> Positive Review
            </button>
            <button
              type="button"
              className={`mode-btn ${form.type === 'Complaint' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, type: 'Complaint' })}
              style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
            >
              <AlertTriangle size={16} /> Report Complaint
            </button>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
                Category
              </label>
              <div className="input-group" style={{ margin: 0 }}>
                <Tag size={16} style={{ color: 'var(--text3)' }} />
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '0.88rem', color: 'var(--text)' }}
                >
                  <option value="Food Quality">Food Quality</option>
                  <option value="Delivery Speed">Delivery Speed</option>
                  <option value="Missing Item">Missing Item</option>
                  <option value="Customer Support">Customer Support</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
                Your Rating
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-alt)',
                height: '44px'
              }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setForm({ ...form, rating: star })}
                    aria-label={`${star} stars`}
                    style={{ padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Star
                      size={20}
                      fill={star <= form.rating ? 'var(--amber)' : 'none'}
                      color={star <= form.rating ? 'var(--amber)' : 'var(--text3)'}
                    />
                  </button>
                ))}
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--amber)', marginLeft: '6px' }}>
                  {form.rating}/5
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
                Your Name
              </label>
              <div className="input-group" style={{ margin: 0 }}>
                <User size={16} style={{ color: 'var(--text3)' }} />
                <input
                  type="text"
                  placeholder="e.g. Alex Smith"
                  value={form.customerName}
                  onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
                Order Number (Optional)
              </label>
              <div className="input-group" style={{ margin: 0 }}>
                <Hash size={16} style={{ color: 'var(--text3)' }} />
                <input
                  type="text"
                  placeholder="e.g. RFC-8942"
                  value={form.orderNumber}
                  onChange={(event) => setForm({ ...form, orderNumber: event.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>
              {form.type === 'Complaint' ? 'Complaint Details' : 'Your Comments'}
            </label>
            <textarea
              placeholder={form.type === 'Complaint' ? 'Tell us what went wrong with your order...' : 'Tell Watford what you loved about your meal...'}
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-alt)',
                color: 'var(--text)',
                fontSize: '0.88rem',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-submit-modal"
            style={{ width: 'auto', alignSelf: 'flex-start', padding: '12px 28px', gap: '8px' }}
          >
            <Send size={16} /> Submit {form.type}
          </button>
        </form>
      )}

      {/* Feedback List / Grid */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '48px 24px',
          textAlign: 'center'
        }}>
          <Filter size={32} style={{ color: 'var(--text3)', marginBottom: '12px' }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text2)', margin: 0 }}>
            No feedback found in this category.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filtered.map((item, index) => (
            <motion.article
              key={item.id || index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(index, 8) * 0.04 }}
              style={{
                background: 'var(--white)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                position: 'relative'
              }}
            >
              {/* Card Header Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: item.type === 'Complaint' ? 'var(--red-light)' : 'linear-gradient(135deg, #FEF2F2, #FFFBEB)',
                    color: item.type === 'Complaint' ? 'var(--red)' : 'var(--amber)',
                    border: `1px solid ${item.type === 'Complaint' ? '#FEE2E2' : '#FEF3C7'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    flexShrink: 0
                  }}>
                    {(item.customerName || 'R').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h5 style={{ fontFamily: 'var(--font-head)', fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                      {item.customerName || 'RFC Customer'}
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 500 }}>
                        {item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </span>
                      {item.orderNumber && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-alt)', color: 'var(--text2)', fontWeight: 700 }}>
                          Order #{item.orderNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span className={`status-badge ${item.status === 'Resolved' ? 'status-completed' : item.type === 'Complaint' ? 'status-cancelled' : 'status-placed'}`}>
                    {item.status || (item.type === 'Complaint' ? 'Pending' : 'Published')}
                  </span>
                  {item.category && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)' }}>
                      {item.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Star Rating Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star
                    key={starIndex}
                    size={16}
                    fill={starIndex < Number(item.rating || 5) ? 'var(--amber)' : 'none'}
                    color={starIndex < Number(item.rating || 5) ? 'var(--amber)' : 'var(--border)'}
                  />
                ))}
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text2)', marginLeft: '6px' }}>
                  {Number(item.rating || 5)}.0
                </span>
              </div>

              {/* Photo Attachment if present */}
              {(item.photoUrl || item.imageUrl) && (
                <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: '200px', background: 'var(--surface-alt)', border: '1px solid var(--border-light)' }}>
                  <img
                    src={item.photoUrl || item.imageUrl}
                    alt="Customer feedback"
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* Comment Content */}
              <p style={{ fontSize: '0.92rem', color: 'var(--text)', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-line' }}>
                {item.comment}
              </p>

              {/* Store Manager Response */}
              {item.response && (
                <div style={{
                  background: 'var(--surface-alt)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  borderLeft: '4px solid var(--red)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginTop: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--red)' }}>
                    <MessageSquare size={14} /> Store Manager Response
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text2)', margin: 0, lineHeight: '1.45' }}>
                    {item.response}
                  </p>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-light)', marginTop: '4px' }}>
                  {activeRespondId === item.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        placeholder="Write manager reply or resolution details..."
                        value={responseText}
                        onChange={(event) => setResponseText(event.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-alt)',
                          fontSize: '0.88rem',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-body)'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="mode-btn"
                          onClick={() => setActiveRespondId(null)}
                          style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-submit-modal"
                          onClick={() => handleAdminRespond(item.id, 'Resolved')}
                          style={{ fontSize: '0.82rem', padding: '8px 16px', width: 'auto' }}
                        >
                          <CheckCircle size={15} /> Mark as Resolved
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-add-item"
                        onClick={() => {
                          setActiveRespondId(item.id);
                          setResponseText(item.response || '');
                        }}
                        style={{ fontSize: '0.82rem' }}
                      >
                        <MessageSquare size={14} /> {item.response ? 'Edit Reply' : 'Reply'}
                      </button>
                      {item.status !== 'Resolved' && (
                        <button
                          type="button"
                          className="mode-btn"
                          onClick={() => handleAdminRespond(item.id, 'Resolved')}
                          style={{ fontSize: '0.78rem', padding: '6px 12px', color: 'var(--green)', borderColor: 'var(--green-light)', background: 'var(--green-light)' }}
                        >
                          <CheckCircle size={14} /> Mark as Resolved
                        </button>
                      )}
                    </div>
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
