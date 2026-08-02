import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
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
        >
          <motion.div
            className="modal-card item-modal-card"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 34, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 34, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="item-modal-image">
              <img
                src={item.imageUrl || fallbackImage}
                alt={item.name}
                onError={(event) => {
                  event.currentTarget.src = fallbackImage;
                }}
              />
            </div>

            <div className="modal-header">
              <div className="item-modal-title-row">
                <div>
                  <h3>{item.name}</h3>
                  <p className="modal-subtitle">{item.description || 'Freshly prepared to order.'}</p>
                </div>
                <span className="card-price">GBP {Number(item.price || 0).toFixed(2)}</span>
              </div>
              <button className="close-btn" type="button" onClick={onClose} aria-label="Close item">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {item.calorieInfo || item.calories ? (
                <p className="cart-line-meta">{item.calorieInfo || `${item.calories} kcal`}</p>
              ) : null}

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

              <div className="option-group">
                <label htmlFor="item-notes">Special requests</label>
                <textarea
                  id="item-notes"
                  className="notes-input"
                  placeholder="Sauce, allergies, or kitchen notes..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <div className="qty-controls">
                <button className="btn-qty" type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  <Minus size={15} />
                </button>
                <span className="qty-val">{quantity}</span>
                <button className="btn-qty" type="button" onClick={() => setQuantity(quantity + 1)}>
                  <Plus size={15} />
                </button>
              </div>
              <button className="btn-submit-modal" type="button" onClick={handleAdd}>
                <ShoppingBag size={17} /> Add to Order - GBP {totalPrice.toFixed(2)}
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
    <div className="option-group">
      <label>{label}</label>
      <div className="option-pill-grid">
        {options.map((option) => (
          <button
            key={option.name}
            className={`option-pill ${selected === option.name ? 'selected' : ''}`}
            type="button"
            onClick={() => onSelect(selected === option.name ? '' : option.name)}
          >
            <span>{option.name}</span>
            {option.extraPrice > 0 && <small>+GBP {option.extraPrice.toFixed(2)}</small>}
            {selected === option.name && <Check size={15} />}
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
