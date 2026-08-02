import PropTypes from 'prop-types';
import { Flame, Leaf, Plus, SlidersHorizontal, Sparkles, Star } from 'lucide-react';
import { motion } from 'framer-motion';

const fallbackImage = 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=84';

export default function MenuItemCard({ item, onSelectItem, index }) {
  const price = Number(item.price || 0);
  const isPopular = item.isBestseller || item.isPopular;
  const isLowStock = Number(item.stockQuantity) > 0 && Number(item.stockQuantity) <= 3;

  return (
    <motion.article
      className="food-card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
    >
      <div className="card-img-wrapper">
        <img
          src={item.imageUrl || fallbackImage}
          alt={item.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
        />

        <div className="badge-list">
          {isPopular && (
            <span className="card-badge badge-bestseller">
              <Star size={12} fill="currentColor" /> Popular
            </span>
          )}
          {item.isBestseller && (
            <span className="card-badge badge-chef">
              <Sparkles size={12} /> Chef&apos;s Pick
            </span>
          )}
          {item.isSpicy && (
            <span className="card-badge badge-spicy">
              <Flame size={12} /> Spicy
            </span>
          )}
          {isLowStock && <span className="card-badge badge-low-stock">Only {item.stockQuantity} left</span>}
        </div>

        <div className="dietary-list">
          {item.isVegetarian && (
            <span className="dietary-badge">
              <span className="dietary-dot" /> Veg
            </span>
          )}
          {!item.isSpicy && (
            <span className="dietary-badge">
              <Leaf size={11} /> Mild
            </span>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{item.name}</h3>
          <span className="card-price">GBP {price.toFixed(2)}</span>
        </div>
        {item.description && <p className="card-desc">{item.description}</p>}
        <div className="card-meta">
          <span>{item.calorieInfo || item.calories || 'Freshly prepared'}</span>
          {item.hasOptions && <span>Customisable</span>}
          {item.categoryName && <span>{item.categoryName}</span>}
        </div>
        <div className="card-footer">
          <button className="btn-add-item" type="button" onClick={() => onSelectItem?.(item)}>
            {item.hasOptions ? (
              <>
                <SlidersHorizontal size={15} /> Customise
              </>
            ) : (
              <>
                <Plus size={15} /> Add to order
              </>
            )}
          </button>
          <button className="btn-add-circle" type="button" onClick={() => onSelectItem?.(item)} aria-label={`Add ${item.name}`}>
            <Plus size={20} />
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
