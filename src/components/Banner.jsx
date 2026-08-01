import React from 'react';
import { ArrowRight, Clock, Copy, ExternalLink, MapPin, Phone, Scissors, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';

const vouchers = [
  { code: 'FIRST10', desc: '10% off your first order' },
  { code: 'OVER25', desc: '10% off orders over GBP 25' },
  { code: 'RFC10', desc: '10% off any order' },
];

const Banner = ({ onApplyVoucher, showToast }) => {
  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    if (onApplyVoucher) onApplyVoucher(code);
    if (showToast) showToast(`Code ${code} copied and applied.`);
  };

  return (
    <section className="banner-container">
      <div className="hero-section">
        <div className="hero-content">
          <span className="hero-eyebrow">Fresh from 119 Courtlands Drive</span>
          <h2 className="hero-title">Watford's Favourite Crispy Chicken</h2>
          <p className="hero-subtitle">
            Golden fried chicken, box meals, burgers and family buckets prepared fresh for delivery or collection.
          </p>
          <div className="hero-actions">
            <a href="#menu" className="hero-primary-action">
              Start order <ArrowRight size={17} />
            </a>
            <a href="tel:+441923961864" className="hero-secondary-action">Call store</a>
          </div>
          <div className="hero-stats">
            <div className="stat-card"><Star className="stat-icon" size={18} /><span>4.8 rating</span></div>
            <div className="stat-card"><TrendingUp className="stat-icon" size={18} /><span>2000+ orders</span></div>
            <div className="stat-card"><Zap className="stat-icon" size={18} /><span>45 min delivery</span></div>
            <div className="stat-card"><Sparkles className="stat-icon" size={18} /><span>Free delivery zone</span></div>
          </div>
        </div>
      </div>

      <div className="promo-section">
        <div className="vouchers-container">
          {vouchers.map((voucher) => (
            <div key={voucher.code} className="voucher-card">
              <div className="voucher-header">
                <Scissors className="voucher-icon" size={18} />
                <span className="voucher-code">{voucher.code}</span>
              </div>
              <p className="voucher-desc">{voucher.desc}</p>
              <button className="copy-btn" onClick={() => handleCopy(voucher.code)}>
                <Copy size={14} /> Copy & Apply
              </button>
            </div>
          ))}
        </div>

        <div className="store-info-card">
          <h3 className="store-title">Store Info</h3>
          <div className="meta-item">
            <MapPin className="meta-icon" size={16} />
            <span>119 Courtlands Drive, Watford WD17 4HZ</span>
          </div>
          <div className="meta-item">
            <Clock className="meta-icon" size={16} />
            <span>Mon-Sun: 11AM - 10PM</span>
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
