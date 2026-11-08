import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import cartReducer, { loadCart, saveCart } from '../features/cart/cartSlice';

// Only the shopping cart is kept in the browser. Everything else comes from the server
// (cookie session + Supabase), which is the source of truth.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    cart: cartReducer,
  },
  preloadedState: { cart: { items: loadCart() } },
});

let savedItems = store.getState().cart.items;
store.subscribe(() => {
  const { items } = store.getState().cart;
  if (items !== savedItems) {
    savedItems = items;
    saveCart(items);
  }
});
