import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';

// Nothing is saved in the browser: the server (cookie session + Supabase) is the source of truth.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
  },
});
