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
          style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <motion.div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              maxWidth: 520, 
              width: '100%', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0, 
              overflow: 'hidden', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
          >
            {/* Header Image with Floating Close Button */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={item.imageUrl || fallbackImage}
                alt={item.name}
                onError={(event) => {
                  event.currentTarget.src = fallbackImage;
                }}
                style={{ width: '100%', height: '180px', objectFit: 'cover' }}
              />
              <button 
                className="close-btn" 
                type="button" 
                onClick={onClose} 
                aria-label="Close item"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#FFF',
                  border: 'none',
                  borderRadius: '50%',
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Item Title & Price */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-head)', margin: 0, fontSize: '1.35rem', color: 'var(--text)', fontWeight: 800 }}>{item.name}</h3>
                  <p style={{ color: 'var(--text2)', margin: '4px 0 0', fontSize: '0.88rem', lineHeight: 1.4 }}>{item.description || 'Freshly prepared to order.'}</p>
                  {(item.calorieInfo || item.calories) ? (
                    <span style={{ display: 'inline-block', background: 'var(--surface-alt)', color: 'var(--text3)', fontSize: '0.78rem', padding: '2px 8px', borderRadius: '12px', marginTop: '6px', fontWeight: 600 }}>
                      🔥 {item.calorieInfo || `${item.calories} kcal`}
                    </span>
                  ) : null}
                </div>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 900, fontSize: '1.25rem', color: 'var(--red)', whiteSpace: 'nowrap' }}>
                  £{Number(item.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Scrollable Modal Content Body */}
            <div className="modal-body" style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
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

              <div style={{ marginTop: 16 }}>
                <label htmlFor="item-notes" style={{ display: 'block', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: 6 }}>Special requests</label>
                <textarea
                  id="item-notes"
                  placeholder="Sauce, allergies, or kitchen notes..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border)', 
                    background: 'var(--surface-alt)', 
                    color: 'var(--text)', 
                    fontFamily: 'var(--font-body)', 
                    resize: 'vertical', 
                    minHeight: 64, 
                    fontSize: '0.88rem',
                    boxSizing: 'border-box' 
                  }}
                />
              </div>
            </div>

            {/* Pinned Sticky Bottom Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: '#FFF', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, boxShadow: '0 -4px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '2px 6px' }}>
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={16} />
                </button>
                <span style={{ width: 28, textAlign: 'center', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '0.95rem' }}>{quantity}</span>
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
                  padding: '13px 18px', 
                  borderRadius: 'var(--radius-full)', 
                  background: 'var(--red)', 
                  color: 'var(--white)', 
                  border: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  fontSize: '0.95rem', 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-head)', 
                  cursor: 'pointer', 
                  boxShadow: 'var(--shadow-red)',
                  transition: 'opacity 0.2s ease'
                }}
              >
                <ShoppingBag size={18} /> Add to Order • £{totalPrice.toFixed(2)}
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
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((option) => {
          const isSelected = selected === option.name;
          return (
            <button
              key={option.name}
              type="button"
              onClick={() => onSelect(isSelected ? '' : option.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: isSelected ? '2px solid var(--red)' : '1px solid var(--border)',
                background: isSelected ? 'var(--red-light)' : '#FFF',
                cursor: 'pointer',
                color: isSelected ? 'var(--red)' : 'var(--text)',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s ease',
                textAlign: 'left'
              }}
            >
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                      width: 18, height: 18, borderRadius: '50%', border: isSelected ? '5px solid var(--red)' : '2px solid var(--border)', background: '#FFF', transition: 'all 0.15s ease', flexShrink: 0
                  }} />
                  <span style={{ fontWeight: isSelected ? 800 : 500, fontSize: '0.88rem' }}>{option.name}</span>
               </div>
               {option.extraPrice > 0 && (
                  <span style={{ color: isSelected ? 'var(--red)' : 'var(--text2)', fontSize: '0.82rem', fontWeight: 700 }}>+£{option.extraPrice.toFixed(2)}</span>
               )}
            </button>
          );
        })}
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
