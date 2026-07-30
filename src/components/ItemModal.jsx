import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Check, ShoppingBag } from 'lucide-react';

const SIDES = ['Regular Fries', 'Beans', 'Coleslaw', 'Corn on the Cob', 'Gravy', 'Wedges (+£0.80)'];
const DRINKS = ['Pepsi 330ml', '7Up 330ml', 'Diet Pepsi 330ml', 'Tango Orange 330ml', 'Still Water 500ml', 'Pepsi 1.5L (+£2.00)'];

const ItemModal = ({ item, onClose, onAddToCart }) => {
  const [selectedSide, setSelectedSide] = useState('');
  const [selectedDrink, setSelectedDrink] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      setSelectedSide('');
      setSelectedDrink('');
      setQuantity(1);
      setNotes('');
    }
  }, [item]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!item) return null;

  const sideExtra = selectedSide && selectedSide.includes('+£') ? 0.80 : 0;
  const drinkExtra = selectedDrink && selectedDrink.includes('+£') ? 2.00 : 0;
  const unitPrice = item.price + sideExtra + drinkExtra;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    onAddToCart({
      item,
      selectedSide,
      selectedDrink,
      quantity,
      notes,
      unitPrice,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item.name}</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {item.description && <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '16px' }}>{item.description}</p>}
          {item.calories && <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '16px' }}>{item.calories} kcal</p>}

          {item.sideChoices !== false && item.hasOptions && (
            <div className="option-group">
              <label>Choose your side</label>
              <div className="option-pill-grid">
                {SIDES.map(s => (
                  <button key={s} className={`option-pill ${selectedSide === s ? 'selected' : ''}`} onClick={() => setSelectedSide(selectedSide === s ? '' : s)}>
                    <span>{s}</span>
                    {selectedSide === s && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.drinkChoices !== false && item.hasOptions && (
            <div className="option-group">
              <label>Choose your drink</label>
              <div className="option-pill-grid">
                {DRINKS.map(d => (
                  <button key={d} className={`option-pill ${selectedDrink === d ? 'selected' : ''}`} onClick={() => setSelectedDrink(selectedDrink === d ? '' : d)}>
                    <span>{d}</span>
                    {selectedDrink === d && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="option-group">
            <label>Special Requests</label>
            <textarea
              placeholder="Any dietary requirements or special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%', padding: '12px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', resize: 'vertical',
                minHeight: '70px', fontFamily: 'inherit', background: 'var(--bg)'
              }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div className="qty-controls">
            <button className="btn-qty" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button>
            <span className="qty-val">{quantity}</span>
            <button className="btn-qty" onClick={() => setQuantity(quantity + 1)}><Plus size={14} /></button>
          </div>
          <button className="btn-submit-modal" onClick={handleAdd}>
            <ShoppingBag size={16} /> Add to Basket · £{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
