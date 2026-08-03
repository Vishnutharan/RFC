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
  ArrowRight,
  Sparkles,
  Tag
} from 'lucide-react';

const vouchers = [
  {
    code: 'FIRST10',
    title: '10% OFF First Order',
    desc: 'Valid for new customers. Instant discount at checkout.'
  },
  {
    code: 'OVER25',
    title: '10% OFF Orders over £25',
    desc: 'Valid on all delivery & collection orders over £25.'
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
      showToast(`Voucher ${code} copied & applied! ✨`, 'success');
    }
  };

  return (
    <section className="banner-container">
      {/* Hero Banner Section */}
      <div
        className="hero-section"
        style={{
          background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
            Open Now &bull; Delivering Fresh in Watford
          </div>

          <h1 className="hero-title">
            Watford&apos;s Crispiest Chicken,{' '}
            <span className="gradient-text">Delivered Fresh to Your Door</span>
          </h1>

          <p className="hero-subtitle">
            Artisan fried chicken, stacked box meals, hot wings, and fresh sides prepared daily in our Watford kitchen.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="#menu"
              className="btn-submit-modal"
              style={{ textDecoration: 'none', padding: '10px 22px', fontSize: '0.88rem' }}
            >
              Order Now <ArrowRight size={16} />
            </motion.a>
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

      {/* Compact Promotions & Store Info Bar */}
      <div id="deals" className="promo-section" style={{ marginTop: '16px' }}>
        
        {/* Sleek Compact Vouchers */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {vouchers.map((voucher, index) => (
            <motion.div
              key={voucher.code}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              style={{
                flex: '1 1 260px',
                maxWidth: '340px',
                background: '#FFF',
                border: '1.5px dashed var(--red)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={15} color="var(--red)" />
                  <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '0.95rem', color: 'var(--red)' }}>
                    {voucher.code}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: '2px 0 0 0', fontWeight: 600 }}>
                  {voucher.desc}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(voucher.code)}
                style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <Copy size={13} /> Copy Code
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Compact Store Info Bar */}
        <div style={{
          background: '#FFF',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)', margin: 0 }}>
              📍 RFC Watford Kitchen
            </h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text2)', display: 'block', marginTop: '2px' }}>
              119 Courtlands Drive, Watford WD17 4HZ &bull; 🕒 Mon-Sun 11AM-10PM
            </span>
          </div>

          <a
            href="https://www.google.com/maps/dir/?api=1&destination=RFC%20Watford,%20119%20Courtlands%20Drive,%20Watford%20WD17%204HZ"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: 'var(--red)',
              textDecoration: 'none',
              background: 'var(--red-light)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            Get directions <ExternalLink size={13} />
          </a>
        </div>

      </div>
    </section>
  );
}

Banner.propTypes = {
  onApplyVoucher: PropTypes.func,
  showToast: PropTypes.func
};
