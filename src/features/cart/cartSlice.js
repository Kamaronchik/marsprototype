import { createSlice } from '@reduxjs/toolkit';
import { logout } from '../auth/authSlice';

const STORAGE_KEY = 'mars-cart';
export const MAX_QUANTITY = 10;

// The cart is only a shopping list: the server counts the real prices when the student pays.
export const loadCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export const saveCart = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Private mode or full storage: the cart just will not survive a reload.
  }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] },
  reducers: {
    addItem: (state, action) => {
      const { id, name, price, imageUrl } = action.payload;
      const found = state.items.find((item) => item.productId === id);
      if (found) {
        found.quantity = Math.min(MAX_QUANTITY, found.quantity + 1);
      } else {
        state.items.push({ productId: id, name, price, imageUrl, quantity: 1 });
      }
    },
    setQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const found = state.items.find((item) => item.productId === productId);
      if (!found) return;
      found.quantity = Math.min(MAX_QUANTITY, quantity);
      if (found.quantity < 1) state.items = state.items.filter((item) => item.productId !== productId);
    },
    removeItem: (state, action) => {
      state.items = state.items.filter((item) => item.productId !== action.payload);
    },
    clearCart: (state) => {
      state.items = [];
    },
  },
  // Another student may use this browser next: log out empties the cart.
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      state.items = [];
    });
  },
});

export const { addItem, setQuantity, removeItem, clearCart } = cartSlice.actions;

export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectCartTotal = (state) => state.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export default cartSlice.reducer;
