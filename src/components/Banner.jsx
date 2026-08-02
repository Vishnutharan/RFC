import PropTypes from 'prop-types';
import { ArrowRight, ChevronDown, Clock, Copy, ExternalLink, MapPin, Phone, Scissors, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const vouchers = [
  { code: 'FIRST10', desc: '10% off your first direct order' },
  { code: 'OVER25', desc: '10% off orders over GBP 25' },
  { code: 'RFC10', desc: 'Direct website reward' }
];

const stats = [
  { icon: Star, label: '4.8 local rating' },
  { icon: TrendingUp, label: '2000+ direct orders' },
  { icon: Zap, label: 'Priority dispatch' },
  { icon: Sparkles, label: 'Fresh daily prep' }
];

export default function Banner({ onApplyVoucher, showToast }) {
  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    onApplyVoucher?.(code);
    showToast?.(`Code ${code} copied and applied.`);
  };

  return (
    <section className="banner-container">
      <div className="hero-section">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="live-status-badge">
            <span className="live-dot" />
            Open now - delivering in 25 min
          </span>
          <h2 className="hero-title">Watford&apos;s Finest. Delivered Fast.</h2>
          <p className="hero-subtitle">
            Artisan fried chicken, stacked box meals, hot wings and fresh sides from our kitchen to your door. Track every step.
          </p>
          <div className="hero-actions">
            <a href="#menu" className="hero-primary-action">
              Order Now <ArrowRight size={18} />
            </a>
            <a href="#menu" className="hero-secondary-action">View Menu</a>
          </div>
          <div className="hero-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <span key={stat.label} className="stat-card">
                  <Icon className="stat-icon" size={18} />
                  {stat.label}
                </span>
              );
            })}
          </div>
        </motion.div>
        <a className="hero-scroll-cue" href="#menu" aria-label="Scroll to menu">
          <ChevronDown size={28} />
        </a>
      </div>

      <div id="deals" className="promo-section">
        <div className="vouchers-container">
          {vouchers.map((voucher, index) => (
            <motion.div
              key={voucher.code}
              className="voucher-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.06 }}
            >
              <div className="voucher-header">
                <Scissors className="voucher-icon gold-text" size={18} />
                <span className="voucher-code">{voucher.code}</span>
              </div>
              <p className="voucher-desc">{voucher.desc}</p>
              <button className="copy-btn" type="button" onClick={() => handleCopy(voucher.code)}>
                <Copy size={14} /> Copy &amp; apply
              </button>
            </motion.div>
          ))}
        </div>

        <aside className="store-info-card">
          <h3 className="store-title">RFC Watford</h3>
          <div className="meta-item">
            <MapPin className="meta-icon" size={17} />
            <span>119 Courtlands Drive, Watford WD17 4HZ</span>
          </div>
          <div className="meta-item">
            <Clock className="meta-icon" size={17} />
            <span>Mon-Sun: 11AM - 10PM</span>
          </div>
          <div className="meta-item">
            <Phone className="meta-icon" size={17} />
            <span>+44 1923 961864</span>
          </div>
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=RFC%20Watford,%20119%20Courtlands%20Drive,%20Watford%20WD17%204HZ"
            target="_blank"
            rel="noreferrer"
            className="directions-link"
          >
            Get directions <ExternalLink size={14} />
          </a>
        </aside>
      </div>
    </section>
  );
}

Banner.propTypes = {
  onApplyVoucher: PropTypes.func,
  showToast: PropTypes.func
};
