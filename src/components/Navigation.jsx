import React, { useRef, useMemo } from 'react';
import { MENU_ITEMS } from '../data/initialMenu';

const Navigation = ({ activeCategory, setActiveCategory }) => {
  const scrollRef = useRef(null);

  const categories = useMemo(() => [
    { id: 'all', name: 'Full Menu', icon: '🍽️' },
    { id: 'box-meals', name: 'Box Meals', icon: '📦' },
    { id: 'burgers-meals', name: 'Burgers & Meals', icon: '🍔' },
    { id: 'family-buckets', name: 'Family Buckets', icon: '🪣' },
    { id: 'fried-chicken', name: 'Fried Chicken & Wings', icon: '🍗' },
    { id: 'wraps', name: 'Wraps & Ribs', icon: '🌯' },
    { id: 'sides', name: 'Sides & Dips', icon: '🍟' },
    { id: 'desserts-drinks', name: 'Desserts & Drinks', icon: '🍨' },
    { id: 'kids', name: 'Kids Meals', icon: '👶' },
  ], []);

  const getCount = (catId) => {
    if (!MENU_ITEMS) return 0;
    if (catId === 'all') return MENU_ITEMS.length;
    return MENU_ITEMS.filter(i => i.categoryId === catId).length;
  };

  const handleClick = (catId) => {
    setActiveCategory(catId);
    const container = scrollRef.current;
    if (container) {
      const tab = container.querySelector(`[data-id="${catId}"]`);
      if (tab) {
        const left = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
        container.scrollTo({ left, behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="category-nav-bar">
      <div className="category-nav-container" ref={scrollRef}>
        {categories.map(cat => (
          <button
            key={cat.id}
            data-id={cat.id}
            className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleClick(cat.id)}
          >
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.name}</span>
            <span className="cat-badge">{getCount(cat.id)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;
