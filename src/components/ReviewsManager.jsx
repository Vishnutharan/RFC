import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, AlertCircle, CheckCircle, Send, ThumbsUp, Filter } from 'lucide-react';
import { getReviewsAndComplaints, addReviewOrComplaint, updateFeedbackStatus } from '../services/feedbackApi';

export default function ReviewsManager({ isAdmin = false, showToast }) {
  const [items, setItems] = useState([]);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Reviews', 'Complaints', 'Pending'
  
  // Submission Form State
  const [form, setForm] = useState({
    customerName: '',
    rating: 5,
    type: 'Review', // 'Review' or 'Complaint'
    category: 'Food Quality',
    comment: '',
    orderNumber: ''
  });

  // Admin Response State
  const [activeRespondId, setActiveRespondId] = useState(null);
  const [responseText, setResponseText] = useState('');

  const loadData = async () => {
    try {
      const data = await getReviewsAndComplaints();
      setItems(data || []);
    } catch (error) {
      setItems([]);
      if (showToast) showToast(error.message || 'Feedback could not be loaded.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.comment.trim()) return;

    try {
      await addReviewOrComplaint(form);
      setForm({
        customerName: '', rating: 5, type: 'Review',
        category: 'Food Quality', comment: '', orderNumber: ''
      });
      await loadData();
      if (showToast) showToast(form.type === 'Complaint' ? 'Complaint submitted. Manager will respond shortly!' : 'Thank you for your review!');
    } catch (error) {
      if (showToast) showToast(error.message || 'Feedback could not be submitted.', 'error');
    }
  };

  const handleAdminRespond = async (id, newStatus = 'Resolved') => {
    try {
      await updateFeedbackStatus(id, newStatus, responseText);
      setActiveRespondId(null);
      setResponseText('');
      await loadData();
      if (showToast) showToast('Status and response updated!');
    } catch (error) {
      if (showToast) showToast(error.message || 'Feedback status could not be updated.', 'error');
    }
  };

  // Filtered List
  const filtered = items.filter(item => {
    if (filterType === 'Reviews') return item.type === 'Review';
    if (filterType === 'Complaints') return item.type === 'Complaint';
    if (filterType === 'Pending') return item.status === 'Pending';
    return true;
  });

  const avgRating = items.length
    ? (items.reduce((s, i) => s + (i.rating || 5), 0) / items.length).toFixed(1)
    : '5.0';

  const pendingComplaintsCount = items.filter(i => i.type === 'Complaint' && i.status === 'Pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF5F5, #FFF8ED)',
        borderRadius: 'var(--radius)', padding: '20px', border: '1px solid #FDE2E2',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px'
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star color="var(--amber)" fill="var(--amber)" size={22} /> {avgRating} / 5.0 Rating &amp; Feedback
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: '2px' }}>
            {items.length} verified customer reviews · {pendingComplaintsCount} pending complaint{pendingComplaintsCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['All', 'Reviews', 'Complaints', 'Pending'].map(t => (
            <button
              key={t}
              className={`cat-tab ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              {t} {t === 'Pending' && pendingComplaintsCount > 0 && `(${pendingComplaintsCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Submission Form (Hidden if Admin viewing reviews only) */}
      {!isAdmin && (
        <form onSubmit={handleFormSubmit} style={{
          background: 'var(--white)', padding: '20px', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)'
        }}>
          <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px' }}>
            ✍️ Leave a Review or Submit a Complaint
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Feedback Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <option value="Review">Positive Review</option>
                <option value="Complaint">Report Complaint / Issue</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
              >
                <option value="Food Quality">Food Quality &amp; Taste</option>
                <option value="Delivery Speed">Delivery Speed</option>
                <option value="Missing Item">Missing / Incorrect Item</option>
                <option value="Customer Support">Customer Service</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Star Rating</label>
              <div style={{ display: 'flex', gap: '4px', paddingTop: '4px' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setForm({ ...form, rating: star })}
                    style={{ cursor: 'pointer' }}
                  >
                    <Star
                      size={20}
                      color="var(--amber)"
                      fill={star <= form.rating ? 'var(--amber)' : 'transparent'}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Your Name (Optional)"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
            />
            <input
              type="text"
              placeholder="Order Number (Optional e.g. RFC-12345)"
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>

          <textarea
            placeholder={form.type === 'Complaint' ? 'Please describe what went wrong with your order...' : 'Write your review about the food and service...'}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', fontSize: '0.88rem', minHeight: '70px', marginBottom: '12px'
            }}
          />

          <button type="submit" className="btn-submit-modal" style={{ width: 'auto', padding: '10px 24px' }}>
            <Send size={15} /> Submit {form.type}
          </button>
        </form>
      )}

      {/* Reviews & Complaints Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>No feedback found in this category.</p>
        ) : (
          filtered.map(item => (
            <div key={item.id} style={{
              background: 'var(--white)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '16px',
              borderLeft: item.type === 'Complaint' ? '4px solid var(--red)' : '4px solid var(--green)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{item.customerName}</span>
                  {item.orderNumber && (
                    <span style={{ fontSize: '0.75rem', background: 'var(--bg)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text2)' }}>
                      #{item.orderNumber}
                    </span>
                  )}
                  <span className={`status-badge ${item.type === 'Complaint' ? 'status-preparing' : 'status-completed'}`}>
                    {item.type} · {item.category}
                  </span>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                  {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                </span>
              </div>

              {/* Star rating */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} color="var(--amber)" fill={i < item.rating ? 'var(--amber)' : 'transparent'} />
                ))}
              </div>

              {/* Comment text */}
              <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.5 }}>{item.comment}</p>

              {/* Manager Response */}
              {item.response && (
                <div style={{
                  background: 'var(--bg)', borderLeft: '3px solid var(--amber)',
                  padding: '10px 12px', marginTop: '10px', borderRadius: '0 8px 8px 0', fontSize: '0.82rem'
                }}>
                  <strong style={{ color: 'var(--text)' }}>Store Manager Response:</strong>
                  <p style={{ color: 'var(--text2)', marginTop: '2px' }}>{item.response}</p>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {activeRespondId === item.id ? (
                    <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Write manager reply or voucher code..."
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem' }}
                      />
                      <button
                        onClick={() => handleAdminRespond(item.id, 'Resolved')}
                        style={{ padding: '6px 12px', background: 'var(--green)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Save &amp; Resolve
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setActiveRespondId(item.id); setResponseText(item.response || ''); }}
                      className="btn-add-item"
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      <MessageSquare size={13} /> {item.response ? 'Edit Reply' : 'Respond to Customer'}
                    </button>
                  )}

                  {item.type === 'Complaint' && (
                    <span className={`status-badge ${item.status === 'Resolved' ? 'status-completed' : 'status-preparing'}`} style={{ marginLeft: 'auto' }}>
                      Status: {item.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
