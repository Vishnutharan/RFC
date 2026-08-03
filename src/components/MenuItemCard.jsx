import PropTypes from 'prop-types';
import { Flame, Leaf, Plus, SlidersHorizontal, Sparkles, Star } from 'lucide-react';
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

  return (
    <motion.article
      className="food-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
    >
      <div className="card-img-wrapper">
        <img
          src={item?.imageUrl || fallbackImage}
          alt={item?.name || 'Food item'}
          loading="lazy"
          onError={handleImageError}
        />

        <div className="badge-list">
          {isPopular && (
            <span className="card-badge badge-bestseller">
              <Star size={12} fill="currentColor" /> Popular
            </span>
          )}
          {item?.isBestseller && (
            <span className="card-badge badge-chef" style={{ background: 'var(--indigo)', color: '#FFF' }}>
              <Sparkles size={12} /> Chef&apos;s Pick
            </span>
          )}
          {item?.isSpicy && (
            <span className="card-badge badge-spicy">
              <Flame size={12} /> Spicy
            </span>
          )}
          {isLowStock && (
            <span className="card-badge badge-low-stock" style={{ background: 'var(--amber)', color: '#FFF' }}>
              Only {item.stockQuantity} left
            </span>
          )}
        </div>

        <div className="dietary-list" style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 2 }}>
          {item?.isVegetarian && (
            <span className="card-badge" style={{ background: 'var(--green)', color: '#FFF' }}>
              <Leaf size={11} /> Veg
            </span>
          )}
          {!item?.isSpicy && (
            <span className="card-badge" style={{ background: 'rgba(255, 255, 255, 0.9)', color: 'var(--text2)', backdropFilter: 'blur(4px)' }}>
              <Leaf size={11} /> Mild
            </span>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <h3 className="card-title" style={{ fontFamily: 'var(--font-head)', margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
            {item?.name}
          </h3>
        </div>

        {item?.description && (
          <p className="card-desc" style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text2)' }}>
            {item.description}
          </p>
        )}

        <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text3)', marginTop: '4px', flexWrap: 'wrap' }}>
          {caloriesText && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600, color: 'var(--text2)' }}>
              <Flame size={12} style={{ color: 'var(--amber)' }} />
              {caloriesText}
            </span>
          )}
          {item?.hasOptions && (
            <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.72rem' }}>
              Customisable
            </span>
          )}
          {item?.categoryName && (
            <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>
              {item.categoryName}
            </span>
          )}
        </div>

        <div className="card-footer">
          <span className="card-price" style={{ fontFamily: 'var(--font-head)', color: 'var(--red)', fontWeight: 900, fontSize: '1.15rem' }}>
            GBP {price.toFixed(2)}
          </span>
          <button
            className="btn-add-item"
            type="button"
            onClick={() => onSelectItem?.(item)}
            aria-label={item?.hasOptions ? `Customise ${item.name}` : `Add ${item.name} to order`}
          >
            {item?.hasOptions ? (
              <>
                <SlidersHorizontal size={15} /> Customise
              </>
            ) : (
              <>
                <Plus size={15} /> Add to order
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
