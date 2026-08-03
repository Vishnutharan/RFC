import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const fallbackImage = 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=900&auto=format&fit=crop&q=86';
const defaultSides = [
  { name: 'Regular Fries', extraPrice: 0 },
  { name: 'Beans', extraPrice: 0 },
  { name: 'Coleslaw', extraPrice: 0 },
  { name: 'Corn on the Cob', extraPrice: 0 },
  { name: 'Gravy', extraPrice: 0 },
  { name: 'Wedges', extraPrice: 0.8 }
];
const defaultDrinks = [
  { name: 'Pepsi 330ml', extraPrice: 0 },
  { name: '7Up 330ml', extraPrice: 0 },
  { name: 'Diet Pepsi 330ml', extraPrice: 0 },
  { name: 'Tango Orange 330ml', extraPrice: 0 },
  { name: 'Still Water 500ml', extraPrice: 0 },
  { name: 'Pepsi 1.5L Bottle', extraPrice: 2 }
];

const normaliseOption = (option) => {
  if (typeof option === 'string') {
    const match = option.match(/\+GBP\s?([0-9.]+)/i) || option.match(/\+[^0-9]*([0-9.]+)/);
    return { name: option, extraPrice: match ? Number(match[1]) : 0 };
  }
  return { name: option.name, extraPrice: Number(option.extraPrice || 0) };
};

export default function ItemModal({ item, onClose, onAddToCart }) {
  const [selectedSide, setSelectedSide] = useState('');
  const [selectedDrink, setSelectedDrink] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const sideOptions = useMemo(
    () => (Array.isArray(item?.sideChoices) && item.sideChoices.length ? item.sideChoices : defaultSides).map(normaliseOption),
    [item]
  );
  const drinkOptions = useMemo(
    () => (Array.isArray(item?.drinkChoices) && item.drinkChoices.length ? item.drinkChoices : defaultDrinks).map(normaliseOption),
    [item]
  );

  useEffect(() => {
    if (!item) return;
    setSelectedSide('');
    setSelectedDrink('');
    setQuantity(1);
    setNotes('');
  }, [item]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const selectedSideOption = sideOptions.find((option) => option.name === selectedSide);
  const selectedDrinkOption = drinkOptions.find((option) => option.name === selectedDrink);
  const unitPrice = Number(item?.price || 0) + Number(selectedSideOption?.extraPrice || 0) + Number(selectedDrinkOption?.extraPrice || 0);
  const totalPrice = unitPrice * quantity;

  const handleAdd = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    confetti({
      particleCount: 70,
      spread: 45,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight
      },
      colors: ['#E8A93F', '#D9534F', '#4ADE80', '#F3F4F6']
    });

    onAddToCart({
      item,
      selectedSide,
      selectedDrink,
      quantity,
      notes,
      unitPrice
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 34, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 34, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              maxWidth: 500, 
              width: '100%', 
              margin: '20px', 
              padding: 0, 
              overflow: 'hidden', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-lg)' 
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={item.imageUrl || fallbackImage}
                alt={item.name}
                onError={(event) => {
                  event.currentTarget.src = fallbackImage;
                }}
                style={{ width: '100%', height: 240, objectFit: 'cover' }}
              />
              <button 
                className="close-btn" 
                type="button" 
                onClick={onClose} 
                aria-label="Close item"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'var(--white)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: 8,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-header" style={{ padding: '24px 24px 0', borderBottom: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-head)', margin: 0, fontSize: '1.5rem', color: 'var(--text)', fontWeight: 600 }}>{item.name}</h3>
                  <p style={{ color: 'var(--text2)', margin: '4px 0 0', fontSize: '0.95rem' }}>{item.description || 'Freshly prepared to order.'}</p>
                  {(item.calorieInfo || item.calories) ? (
                    <p style={{ color: 'var(--text3)', fontSize: '0.85rem', margin: '4px 0 0' }}>{item.calorieInfo || `${item.calories} kcal`}</p>
                  ) : null}
                </div>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)' }}>
                  GBP {Number(item.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="modal-body" style={{ padding: 24, maxHeight: '50vh', overflowY: 'auto' }}>
              {item.hasOptions && item.sideChoices !== false && (
                <OptionGroup
                  label="Choose your side"
                  options={sideOptions}
                  selected={selectedSide}
                  onSelect={setSelectedSide}
                />
              )}

              {item.hasOptions && item.drinkChoices !== false && (
                <OptionGroup
                  label="Choose your drink"
                  options={drinkOptions}
                  selected={selectedDrink}
                  onSelect={setSelectedDrink}
                />
              )}

              <div style={{ marginTop: 24 }}>
                <label htmlFor="item-notes" style={{ display: 'block', fontFamily: 'var(--font-head)', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Special requests</label>
                <textarea
                  id="item-notes"
                  placeholder="Sauce, allergies, or kitchen notes..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: 16, 
                    borderRadius: 'var(--radius)', 
                    border: '1px solid var(--border)', 
                    background: 'var(--surface-alt)', 
                    color: 'var(--text)', 
                    fontFamily: 'var(--font-body)', 
                    resize: 'vertical', 
                    minHeight: 80, 
                    boxSizing: 'border-box' 
                  }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 24, borderTop: '1px solid var(--border-light)', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-alt)', borderRadius: 'var(--radius-full)', padding: '4px 8px' }}>
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={16} />
                </button>
                <span style={{ width: 32, textAlign: 'center', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{quantity}</span>
                <button type="button" onClick={() => setQuantity(quantity + 1)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={16} />
                </button>
              </div>
              <button 
                className="btn-submit-modal" 
                type="button" 
                onClick={handleAdd}
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  borderRadius: 'var(--radius-full)', 
                  background: 'var(--red)', 
                  color: 'var(--white)', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  fontSize: '1rem', 
                  fontWeight: 600, 
                  fontFamily: 'var(--font-head)', 
                  cursor: 'pointer', 
                  boxShadow: 'var(--shadow-red)',
                  transition: 'opacity 0.2s ease'
                }}
              >
                <ShoppingBag size={18} /> Add to Order - GBP {totalPrice.toFixed(2)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OptionGroup({ label, options, selected, onSelect }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-head)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((option) => (
          <button
            key={option.name}
            type="button"
            onClick={() => onSelect(selected === option.name ? '' : option.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderRadius: 'var(--radius)',
              border: selected === option.name ? '2px solid var(--red)' : '1px solid var(--border)',
              background: selected === option.name ? 'var(--surface)' : 'var(--surface-alt)',
              cursor: 'pointer',
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.2s ease',
              boxShadow: selected === option.name ? 'var(--shadow-sm)' : 'none',
              textAlign: 'left'
            }}
          >
             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: selected === option.name ? '6px solid var(--red)' : '2px solid var(--border)', background: 'var(--white)', transition: 'all 0.2s ease', flexShrink: 0
                }} />
                <span style={{ fontWeight: selected === option.name ? 600 : 400 }}>{option.name}</span>
             </div>
             {option.extraPrice > 0 && (
                <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>+GBP {option.extraPrice.toFixed(2)}</span>
             )}
          </button>
        ))}
      </div>
    </div>
  );
}

ItemModal.propTypes = {
  item: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onAddToCart: PropTypes.func.isRequired
};

OptionGroup.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    extraPrice: PropTypes.number
  })).isRequired,
  selected: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired
};
