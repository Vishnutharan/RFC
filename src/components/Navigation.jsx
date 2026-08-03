import { useMemo, useRef } from 'react';
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
    <nav className="category-nav-bar" aria-label="Menu categories">
      <div className="category-nav-container" ref={scrollRef}>
        {categories.map((cat) => {
          const Icon = typeof cat.icon === 'string' ? (ICON_MAP[cat.icon] || Grid2X2) : (cat.icon || Grid2X2);
          return (
            <button
              key={cat.id}
              data-id={cat.id}
              className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleClick(cat.id)}
            >
              <Icon className="cat-icon" size={16} />
              <span className="cat-name">{cat.name}</span>
              <span className="cat-badge">{getCount(cat.id)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
