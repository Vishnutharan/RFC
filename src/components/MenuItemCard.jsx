import React from 'react';
import { Plus, SlidersHorizontal, Star } from 'lucide-react';

const MenuItemCard = ({ item, onSelectItem, index }) => {
  const handleClick = () => {
    if (onSelectItem) onSelectItem(item);
  };

  return (
    <article className="food-card" style={{ animationDelay: `${Math.min(index, 5) * 0.04}s` }}>
      <div className="card-img-wrapper">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="card-img-fallback">RFC</div>
        )}
        {(item.isBestseller || item.isSpicy || item.isPopular) && (
          <div className="badge-list">
            {(item.isBestseller || item.isPopular) && <span className="card-badge badge-bestseller"><Star size={12} /> Popular</span>}
            {item.isSpicy && <span className="card-badge badge-spicy">Spicy</span>}
          </div>
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{item.name}</h3>
          <span className="card-price">£{item.price.toFixed(2)}</span>
        </div>
        {item.description && <p className="card-desc">{item.description}</p>}
        <div className="card-meta">
          <span>{item.calorieInfo || item.calories || 'Freshly prepared'}</span>
          {item.hasOptions && <span>Customisable</span>}
        </div>
        <div className="card-footer">
          <button className="btn-add-item" onClick={handleClick}>
            {item.hasOptions ? <><SlidersHorizontal size={14} /> Customise</> : <><Plus size={14} /> Add</>}
          </button>
        </div>
      </div>
    </article>
  );
};

export default MenuItemCard;
