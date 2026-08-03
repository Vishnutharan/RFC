import { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import {
  Beef,
  Drumstick,
  Grid2X2,
  IceCream,
  Package,
  Popcorn,
  ShoppingBag,
  Smile,
  UtensilsCrossed,
  Flame
} from 'lucide-react';
import { CATEGORIES, MENU_ITEMS } from '../data/initialMenu';

const ICON_MAP = {
  Grid2X2,
  Package,
  Beef,
  ShoppingBag,
  Drumstick,
  UtensilsCrossed,
  Popcorn,
  IceCream,
  Smile,
  Flame
};

const Navigation = ({ activeCategory, setActiveCategory }) => {
  const scrollRef = useRef(null);

  const categories = useMemo(() => [
    { id: 'all', name: 'Full Menu', icon: 'Grid2X2' },
    ...(CATEGORIES || []),
  ], []);

  const getCount = (catId) => {
    if (!MENU_ITEMS) return 0;
    if (catId === 'all') return MENU_ITEMS.length;
    return MENU_ITEMS.filter((item) => item.categoryId === catId).length;
  };

  const handleClick = (catId) => {
    setActiveCategory(catId);
    const container = scrollRef.current;
    if (!container) return;

    const tab = container.querySelector(`[data-id="${catId}"]`);
    if (!tab) return;

    const left = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
    container.scrollTo({ left, behavior: 'smooth' });
  };

  return (
    <nav className="category-nav-bar" aria-label="Menu categories" id="menu">
      <div className="category-nav-container" ref={scrollRef}>
        {categories.map((cat) => {
          const Icon = typeof cat.icon === 'string' ? (ICON_MAP[cat.icon] || Grid2X2) : (cat.icon || Grid2X2);
          const isActive = activeCategory === cat.id;
          const count = getCount(cat.id);

          return (
            <motion.button
              key={cat.id}
              data-id={cat.id}
              whileTap={{ scale: 0.96 }}
              className={`cat-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleClick(cat.id)}
              style={{ position: 'relative' }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCategoryBg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--red)',
                    boxShadow: 'var(--shadow-red)',
                    zIndex: 0
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Icon className="cat-icon" size={16} style={{ color: isActive ? '#FFF' : 'var(--red)' }} />
                <span className="cat-name" style={{ color: isActive ? '#FFF' : 'var(--text)', fontWeight: 800 }}>
                  {cat.name}
                </span>
                <span
                  className="cat-badge"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-alt)',
                    color: isActive ? '#FFF' : 'var(--text2)',
                    fontWeight: 900
                  }}
                >
                  {count}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

Navigation.propTypes = {
  activeCategory: PropTypes.string.isRequired,
  setActiveCategory: PropTypes.func.isRequired
};

export default Navigation;
