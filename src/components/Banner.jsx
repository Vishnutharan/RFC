import React from 'react';
import { Star, TrendingUp, Zap, Sparkles, Clock, MapPin, Phone, Copy, Scissors, ExternalLink } from 'lucide-react';

const Banner = ({ onApplyVoucher, showToast }) => {
  const vouchers = [
    { code: 'FIRST10', desc: '10% off your first order', highlight: 'First Order' },
    { code: 'OVER25', desc: '10% off orders over £25', highlight: 'Over £25' },
    { code: 'RFC10', desc: '10% off any order', highlight: 'Any Order' },
  ];

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    if (onApplyVoucher) onApplyVoucher(code);
    if (showToast) showToast(`Code ${code} copied & applied! 🎉`);
  };

  return (
    <section className="banner-container">
      <div className="hero-section">
        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="hero-content">
          <h2 className="hero-title gradient-text">Watford's Favourite Crispy Chicken</h2>
          <p className="hero-subtitle">Order direct from RFC for the best prices — no commission, no middlemen. Just fresh, crispy chicken delivered to your door.</p>
          <div className="hero-stats">
            <div className="stat-card"><Star className="stat-icon" size={18} /><span>4.8★ Rating</span></div>
            <div className="stat-card"><TrendingUp className="stat-icon" size={18} /><span>2000+ Orders</span></div>
            <div className="stat-card"><Zap className="stat-icon" size={18} /><span>45 min Delivery</span></div>
            <div className="stat-card"><Sparkles className="stat-icon" size={18} /><span>Free Delivery</span></div>
          </div>
        </div>
      </div>

      <div className="promo-section">
        <div className="vouchers-container">
          {vouchers.map((v, i) => (
            <div key={i} className="voucher-card">
              <div className="voucher-header">
                <Scissors className="voucher-icon" size={18} />
                <span className="voucher-code">{v.code}</span>
              </div>
              <p className="voucher-desc">{v.desc}</p>
              <button className="copy-btn" onClick={() => handleCopy(v.code)}>
                <Copy size={14} /> Copy & Apply
              </button>
            </div>
          ))}
        </div>

        <div className="store-info-card">
          <h3 className="store-title">📍 Store Info</h3>
          <div className="meta-item">
            <MapPin className="meta-icon" size={16} />
            <span>119 Courtlands Drive, Watford WD17 4HZ</span>
          </div>
          <div className="meta-item">
            <Clock className="meta-icon" size={16} />
            <span>Mon–Sun: 11AM – 10PM</span>
          </div>
          <div className="meta-item">
            <Phone className="meta-icon" size={16} />
            <span>+44 1923 961864</span>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=RFC%20Watford,%20119%20Courtlands%20Drive,%20Watford%20WD17%204HZ" target="_blank" rel="noreferrer" className="directions-link">
            Get Directions <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Banner;
