import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Clock,
  Star,
  ShoppingBag,
  Scissors,
  Copy,
  MapPin,
  Phone,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

const vouchers = [
  {
    code: 'FIRST10',
    desc: '10% off your first order'
  },
  {
    code: 'OVER25',
    desc: '10% off orders over £25'
  }
];

const stats = [
  {
    icon: Clock,
    color: 'var(--red)',
    label: '25-35 Min Delivery'
  },
  {
    icon: Star,
    color: 'var(--amber)',
    fill: 'var(--amber)',
    label: '4.8 Rating (2,000+)'
  },
  {
    icon: ShoppingBag,
    color: 'var(--green)',
    label: '£10 Minimum Order'
  }
];

export default function Banner({ onApplyVoucher, showToast }) {
  const handleCopy = (code) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    if (onApplyVoucher) {
      onApplyVoucher(code);
    }
    if (showToast) {
      showToast(`Voucher ${code} copied & applied!`, 'success');
    }
  };

  return (
    <section className="banner-container">
      {/* Hero Section */}
      <div
        className="hero-section"
        style={{
          background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--green-light)',
              color: 'var(--green)',
              fontWeight: 800,
              fontSize: '0.78rem',
              marginBottom: '14px'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--green)',
                display: 'inline-block'
              }}
            />
            Open Now &bull; Delivering Fresh
          </div>

          <h1 className="hero-title">
            Watford&apos;s Crispiest Chicken,{' '}
            <span className="gradient-text">Delivered Fresh to Your Door</span>
          </h1>

          <p className="hero-subtitle">
            Artisan fried chicken, stacked box meals, hot wings, and fresh sides prepared daily in our Watford kitchen and delivered hot to your doorstep.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <a
              href="#menu"
              className="btn-submit-modal"
              style={{ textDecoration: 'none', padding: '10px 22px', fontSize: '0.88rem' }}
            >
              Order Now <ArrowRight size={16} />
            </a>
          </div>

          <div className="hero-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-card">
                  <Icon
                    size={16}
                    style={{
                      color: stat.color,
                      fill: stat.fill || 'none'
                    }}
                  />
                  <span>{stat.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Promotions & Store Info Section */}
      <div id="deals" className="promo-section">
        <div className="vouchers-container">
          {vouchers.map((voucher, index) => (
            <motion.div
              key={voucher.code}
              className="voucher-card"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="voucher-code">{voucher.code}</span>
                <Scissors size={16} style={{ color: 'var(--red)' }} />
              </div>
              <p className="voucher-desc">{voucher.desc}</p>
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(voucher.code)}
              >
                <Copy size={14} /> Copy &amp; Apply
              </button>
            </motion.div>
          ))}
        </div>

        <aside className="store-info-card">
          <h3
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: '1.05rem',
              color: 'var(--text)'
            }}
          >
            RFC Watford
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text2)' }}>
            <MapPin size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
            <span>119 Courtlands Drive, Watford WD17 4HZ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text2)' }}>
            <Clock size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <span>Mon-Sun: 11AM - 10PM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text2)' }}>
            <Phone size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <span>+44 1923 961864</span>
          </div>
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=RFC%20Watford,%20119%20Courtlands%20Drive,%20Watford%20WD17%204HZ"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--red)',
              marginTop: 'auto',
              textDecoration: 'none'
            }}
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
