import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import { clearFetchCache } from '../lib/useFetch';
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

// Pages remember their last answers (useFetch); another person must never see them.
let signedInAs = store.getState().auth.user?.id;
store.subscribe(() => {
  const id = store.getState().auth.user?.id;
  if (id !== signedInAs) {
    signedInAs = id;
    clearFetchCache();
  }
});
