import PropTypes from 'prop-types';
import { Flame, Clock, Leaf, Plus, SlidersHorizontal, Sparkles, Star, Utensils, Drumstick } from 'lucide-react';
import { motion } from 'framer-motion';

const fallbackImage = 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=84';

export default function MenuItemCard({ item, onSelectItem, index = 0 }) {
  const price = Number(item?.price || 0);
  const isPopular = item?.isBestseller || item?.isPopular;
  const isLowStock = Number(item?.stockQuantity) > 0 && Number(item?.stockQuantity) <= 3;
  const caloriesText = item?.calorieInfo || (item?.calories ? `${item.calories} kcal` : null);

  const handleImageError = (event) => {
    const img = event.currentTarget;
    if (img.src !== fallbackImage) {
      img.src = fallbackImage;
    } else {
      img.style.display = 'none';
    }
  };

  // Determine icon for top-left badge based on item category or properties
  const renderIconBadge = () => {
    if (item?.isSpicy) return <Flame size={18} color="var(--rose)" />;
    if (item?.isBestseller) return <Sparkles size={18} color="var(--amber)" />;
    if (item?.categoryId === 'burgers' || item?.categoryId === 'wrap') return <Utensils size={18} color="#2563EB" />;
    return <Drumstick size={18} color="var(--rose)" />;
  };

  return (
    <motion.article
      className="food-card reference-service-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1.5px solid rgba(26, 24, 23, 0.07)',
        boxShadow: '0 4px 20px rgba(26, 24, 23, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Top Header Row matching Reference UI */}
      <div
        style={{
          padding: '16px 18px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 2
        }}
      >
        {/* Soft Tinted Icon Badge (Top-Left) */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: item?.isSpicy ? '#FDF2F4' : '#F0F9FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {renderIconBadge()}
        </div>

        {/* Large Serif Price Tag (Top-Right) */}
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#1A1817',
              letterSpacing: '-0.02em',
              lineHeight: 1
            }}
          >
            £{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Food Visual Banner */}
      <div className="card-img-wrapper" style={{ height: '160px', position: 'relative', overflow: 'hidden', background: '#F8FAFC' }}>
        <img
          src={item?.imageUrl || fallbackImage}
          alt={item?.name || 'Food item'}
          loading="lazy"
          onError={handleImageError}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        <div className="badge-list" style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', zIndex: 2 }}>
          {isPopular && (
            <span className="card-badge badge-bestseller" style={{ background: 'var(--amber)', color: '#FFF', padding: '3px 9px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800 }}>
              <Star size={11} fill="currentColor" /> Popular
            </span>
          )}
          {item?.isSpicy && (
            <span className="card-badge badge-spicy" style={{ background: 'var(--rose)', color: '#FFF', padding: '3px 9px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800 }}>
              <Flame size={11} /> Spicy
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="card-body" style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
        <h3
          className="card-title"
          style={{
            fontFamily: 'var(--font-head)',
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: 800,
            color: '#1A1817',
            lineHeight: 1.25
          }}
        >
          {item?.name}
        </h3>

        {item?.description && (
          <p
            className="card-desc"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.82rem',
              color: 'var(--text2)',
              margin: '2px 0 6px 0',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {item.description}
          </p>
        )}

        {/* Card Footer matching Reference UI (Duration/Calories on Left, SELECT action on Right) */}
        <div
          className="card-footer-reference"
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            borderTop: '1px solid rgba(26, 24, 23, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          {/* Bottom Left Info Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text2)' }}>
            <Clock size={13} color="var(--text3)" />
            <span>{caloriesText ? caloriesText : '15-20 MIN'}</span>
          </div>

          {/* Bottom Right Action Button matching "SELECT" in reference screenshot */}
          <button
            className="btn-select-reference"
            type="button"
            onClick={() => onSelectItem?.(item)}
            aria-label={item?.hasOptions ? `Customise ${item.name}` : `Select ${item.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'transparent',
              border: 'none',
              color: 'var(--rose)',
              fontFamily: 'var(--font-head)',
              fontWeight: 900,
              fontSize: '0.82rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {item?.hasOptions ? (
              <>
                <SlidersHorizontal size={13} style={{ marginRight: 2 }} /> Customise
              </>
            ) : (
              <>
                Select <Plus size={13} style={{ marginLeft: 2 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

MenuItemCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    imageUrl: PropTypes.string,
    price: PropTypes.number,
    calorieInfo: PropTypes.string,
    calories: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hasOptions: PropTypes.bool,
    isBestseller: PropTypes.bool,
    isPopular: PropTypes.bool,
    isSpicy: PropTypes.bool,
    isVegetarian: PropTypes.bool,
    stockQuantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    categoryName: PropTypes.string
  }).isRequired,
  onSelectItem: PropTypes.func.isRequired,
  index: PropTypes.number
};

MenuItemCard.defaultProps = {
  index: 0
};
