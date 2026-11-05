import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null, // { id, username, role, fullName, email }
  isAuthenticated: false,
  loading: false,
  error: null,
  sessionChecked: false, // true after we asked the server who is logged in
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    sessionChecked: (state) => {
      state.sessionChecked = true;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, sessionChecked } = authSlice.actions;

// Ask the server who is logged in (uses the httpOnly session cookie).
export const restoreSession = () => async (dispatch) => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = res.ok ? await res.json() : null;
    if (data && data.user) {
      dispatch(loginSuccess(data.user));
    } else {
      dispatch(logout());
    }
  } catch {
    dispatch(logout());
  }
  dispatch(sessionChecked());
};

// Log out on the server (deletes the session) and then clear the UI state.
export const logoutUser = () => async (dispatch) => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    dispatch(logout());
  }
};
export default authSlice.reducer;
