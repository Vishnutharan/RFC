import React, { useRef, useState, useCallback } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';

const MenuItemCard = ({ item, onSelectItem, index }) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * -8, y: (x - 0.5) * 8 });
    setShinePos({ x: x * 100, y: y * 100 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovering(false);
  }, []);

  const handleClick = () => {
    if (onSelectItem) onSelectItem(item);
  };

  return (
    <div
      ref={cardRef}
      className="food-card"
      style={{
        transform: isHovering ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-6px)` : 'perspective(600px) rotateX(0) rotateY(0)',
        animationDelay: `${Math.min(index, 5) * 0.05}s`,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-img-wrapper">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#FFF5F5,#FFF8ED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
            🍗
          </div>
        )}
        <div
          className="card-shine"
          style={{
            opacity: isHovering ? 1 : 0,
            background: `radial-gradient(circle at ${shinePos.x}% ${shinePos.y}%, rgba(255,255,255,0.35), transparent 60%)`
          }}
        />
        {item.badges && item.badges.length > 0 && (
          <div className="badge-list">
            {item.badges.map((b, i) => (
              <span key={i} className={`card-badge ${b === 'Popular' ? 'badge-bestseller' : 'badge-spicy'}`}>{b}</span>
            ))}
          </div>
        )}
        {item.isPopular && !item.badges && (
          <div className="badge-list">
            <span className="card-badge badge-bestseller">Popular</span>
          </div>
        )}
      </div>

      <div className="card-body">
        <h3 className="card-title">{item.name}</h3>
        {item.description && <p className="card-desc">{item.description}</p>}
        <div className="card-footer">
          <div>
            <span className="card-price">£{item.price.toFixed(2)}</span>
            {item.calories && <span className="calorie-tag"> · {item.calories} kcal</span>}
          </div>
          <button className="btn-add-item" onClick={handleClick}>
            {item.hasOptions ? <><SlidersHorizontal size={14} /> Customise</> : <><Plus size={14} /> Add</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
