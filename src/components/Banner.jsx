import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Clock,
  Star,
  ShoppingBag,
  Copy,
  ExternalLink,
  ArrowRight,
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

  const featuredDeals = [
    {
      title: 'BARGAIN BUCKETS',
      desc: '10 Pcs Crispy Chicken + Spicy Wings',
      price: '£11.99',
      badge: 'POPULAR',
      color: 'var(--red)'
    },
    {
      title: 'BONELESS BANQUET',
      desc: 'Crispy Boneless + Regular Fries + Drink',
      price: '£5.49',
      badge: 'BEST VALUE',
      color: '#2563EB'
    },
    {
      title: 'FULLY LOADED BOX',
      desc: 'Burger + Fries + 1 Spicy Wing + Drink',
      price: '£6.49',
      badge: 'MEAL DEAL',
      color: '#D97706'
    },
    {
      title: 'SNACK BOX',
      desc: '3 Spicy Wings & Seasoned Fries',
      price: '£3.49',
      badge: 'SNACK',
      color: '#059669'
    }
  ];

  return (
    <section className="banner-container">
      {/* Premium Hero Section with Storefront Visual */}
      <div
        className="hero-section"
        style={{
          background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8ED 50%, #F8FAFC 100%)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'center'
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
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--red-light)',
              color: 'var(--red)',
              fontWeight: 800,
              fontSize: '0.8rem',
              marginBottom: '14px',
              border: '1px solid var(--red-glow)'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--red)',
                display: 'inline-block'
              }}
            />
            119 Courtlands Drive &bull; Open Now &bull; Watford WD17 4HZ
          </div>

          <h1 className="hero-title" style={{ fontSize: '2.2rem', lineHeight: '1.2' }}>
            RFC Watford <span className="gradient-text">Chicken, Peri Peri & Burgers</span>
          </h1>

          <p className="hero-subtitle">
            Freshly prepared artisan fried chicken, spicy wings, stacked burgers & barbecue ribs. Order direct for fast & free local delivery!
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="#menu"
              className="btn-submit-modal"
              style={{ textDecoration: 'none', padding: '12px 26px', fontSize: '0.95rem', fontWeight: 800 }}
            >
              Explore Menu <ArrowRight size={18} />
            </motion.a>
            <a
              href="tel:01923677407"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: 'var(--radius)',
                background: '#FFF',
                border: '1.5px solid var(--border)',
                fontWeight: 800,
                color: 'var(--text)',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              📞 01923 677407
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

        {/* Storefront Showcase Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            border: '3px solid #FFF',
            maxHeight: '360px'
          }}
        >
          <img
            src="/assets/rfc.png"
            alt="RFC Watford Storefront"
            style={{
              width: '100%',
              height: '360px',
              objectFit: 'cover',
              objectPosition: 'top center'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.2) 60%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '20px',
              color: '#FFF'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span style={{ background: '#E52929', color: '#FFF', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 900 }}>
                AUTHENTIC WATFORD KITCHEN
              </span>
              <span style={{ background: '#10B981', color: '#FFF', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 900 }}>
                5★ FOOD HYGIENE
              </span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#FFF' }}>
              RFC Watford — Courtlands Drive
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#CBD5E1', margin: '4px 0 0 0', fontWeight: 500 }}>
              Serving Watford with crispy chicken, peri peri & banquet box meals.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Featured Deals & Storefront Box Specials */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            🔥 Storefront Specials & Box Meals
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 700 }}>Order Direct & Save</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          {featuredDeals.map((deal, idx) => (
            <motion.div
              key={deal.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              style={{
                background: '#FFF',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                border: '1.5px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: deal.color }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: deal.color, background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    {deal.badge}
                  </span>
                  <span style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', fontWeight: 900, color: 'var(--red)' }}>
                    {deal.price}
                  </span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-head)', fontSize: '0.98rem', fontWeight: 900, color: 'var(--text)', margin: '4px 0 2px 0' }}>
                  {deal.title}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', margin: 0, fontWeight: 500 }}>
                  {deal.desc}
                </p>
              </div>

              <a
                href="#menu"
                style={{
                  marginTop: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: 'var(--red)',
                  textDecoration: 'none',
                  background: 'var(--red-light)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                View Deal <ArrowRight size={13} />
              </a>
            </motion.div>
          ))}
        </div>

        {/* Compact Promotions & Vouchers */}
        <div id="deals" className="promo-section" style={{ marginTop: '16px' }}>
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
            boxShadow: 'var(--shadow-sm)',
            marginTop: '12px'
          }}>
            <div>
              <h4 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)', margin: 0 }}>
                📍 RFC Watford Kitchen & Storefront
              </h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)', display: 'block', marginTop: '2px' }}>
                119 Courtlands Drive, Watford WD17 4HZ &bull; 🕒 Mon-Sun 11AM-10PM &bull; 📞 01923 677407
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
      </div>
    </section>
  );
}

Banner.propTypes = {
  onApplyVoucher: PropTypes.func,
  showToast: PropTypes.func
};
