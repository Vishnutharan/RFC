import { useCallback, useMemo, useState } from 'react';
import { validateVoucher } from '../services/api';

/**
 * @typedef {Object} CartItem
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {number} unitPrice
 * @property {number} quantity
 */

export const useCart = (showToast) => {
  const [cartItems, setCartItems] = useState([]);
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const addMenuItem = useCallback((item) => {
    const cartEntry = {
      id: `${item.id}-${Date.now()}`,
      name: item.name,
      price: item.price,
      unitPrice: item.price,
      quantity: 1,
      options: [],
      selectedSide: '',
      selectedDrink: '',
      item
    };
    setCartItems((prev) => [...prev, cartEntry]);
    showToast?.(`Added ${item.name} to basket.`);
  }, [showToast]);

  const addCustomizedItem = useCallback((cartPayload) => {
    const options = [];
    if (cartPayload.selectedSide) options.push(cartPayload.selectedSide);
    if (cartPayload.selectedDrink) options.push(cartPayload.selectedDrink);

    const cartEntry = {
      id: `${cartPayload.item.id}-${Date.now()}`,
      name: cartPayload.item.name,
      price: cartPayload.unitPrice,
      unitPrice: cartPayload.unitPrice,
      quantity: cartPayload.quantity,
      options,
      selectedSide: cartPayload.selectedSide,
      selectedDrink: cartPayload.selectedDrink,
      item: cartPayload.item
    };

    setCartItems((prev) => [...prev, cartEntry]);
    showToast?.(`Added ${cartPayload.item.name} to basket.`);
  }, [showToast]);

  const updateQuantity = useCallback((idOrIndex, newQty) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((item, idx) => item.id !== idOrIndex && idx !== idOrIndex));
      showToast?.('Item removed from basket', 'info');
      return;
    }

    setCartItems((prev) =>
      prev.map((item, idx) =>
        item.id === idOrIndex || idx === idOrIndex ? { ...item, quantity: newQty } : item
      )
    );
  }, [showToast]);

  const removeItem = useCallback((idOrIndex) => {
    setCartItems((prev) => prev.filter((item, idx) => item.id !== idOrIndex && idx !== idOrIndex));
    showToast?.('Item removed from basket', 'info');
  }, [showToast]);

  const applyVoucher = useCallback((codeOrResult) => {
    if (typeof codeOrResult === 'string') {
      const result = validateVoucher(codeOrResult, cartSubtotal);
      if (result.valid) {
        setAppliedVoucher(result);
        showToast?.(`Voucher ${result.code} applied.`);
      }
      return result;
    }

    if (codeOrResult?.valid) {
      setAppliedVoucher(codeOrResult);
      showToast?.(`Voucher ${codeOrResult.code} applied.`);
    }
    return codeOrResult;
  }, [cartSubtotal, showToast]);

  const removeVoucher = useCallback(() => {
    setAppliedVoucher(null);
    showToast?.('Voucher removed', 'info');
  }, [showToast]);

  const reorder = useCallback((pastOrder) => {
    if (!pastOrder.items?.length) return false;
    const reorderedItems = pastOrder.items.map((item, idx) => ({
      ...item,
      id: `${item.id || 'item'}-${Date.now()}-${idx}`
    }));
    setCartItems(reorderedItems);
    setAppliedVoucher(null);
    showToast?.('Reordered past items into your basket.');
    return true;
  }, [showToast]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setAppliedVoucher(null);
  }, []);

  return {
    cartItems,
    setCartItems,
    appliedVoucher,
    cartCount,
    cartSubtotal,
    addMenuItem,
    addCustomizedItem,
    updateQuantity,
    removeItem,
    applyVoucher,
    removeVoucher,
    reorder,
    clearCart
  };
};
