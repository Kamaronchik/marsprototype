import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// All user data lives in Supabase. Redux only keeps a copy for the UI.
const request = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const fetchUsers = createAsyncThunk('users/fetch', async () => {
  const data = await request('/api/users');
  return data.users;
});

export const createUser = createAsyncThunk('users/create', async (user) => {
  const data = await request('/api/users', { method: 'POST', body: JSON.stringify(user) });
  return data.user;
});

export const updateUser = createAsyncThunk('users/update', async ({ id, changes }) => {
  const data = await request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  return data.user;
});

export const deleteUser = createAsyncThunk('users/delete', async (id) => {
  await request(`/api/users/${id}`, { method: 'DELETE' });
  return id;
});

const usersSlice = createSlice({
  name: 'users',
  initialState: { list: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUsers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchUsers.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(createUser.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateUser.fulfilled, (state, action) => {
        const i = state.list.findIndex((u) => u.id === action.payload.id);
        if (i !== -1) state.list[i] = action.payload;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.list = state.list.filter((u) => u.id !== action.payload);
      });
  },
});

export default usersSlice.reducer;
