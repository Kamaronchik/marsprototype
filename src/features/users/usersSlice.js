import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [
    {
      id: '1',
      username: 'admin',
      password: 'admin',
      role: 'Admin',
      fullName: 'System Administrator',
      email: 'admin@mars-edu.com',
      createdAt: new Date().toISOString(),
      status: 'active',
      emailVerified: true,
    },
  ],
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    addUser: (state, action) => {
      state.list.push(action.payload);
    },
    updateUser: (state, action) => {
      const { id, updatedData } = action.payload;
      const index = state.list.findIndex(user => user.id === id);
      if (index !== -1) {
        state.list[index] = { ...state.list[index], ...updatedData };
      }
    },
    deleteUser: (state, action) => {
      state.list = state.list.filter(user => user.id !== action.payload);
    },
    toggleUserStatus: (state, action) => {
      const user = state.list.find(u => u.id === action.payload);
      if (user) {
        user.status = user.status === 'active' ? 'blocked' : 'active';
      }
    },
    verifyUserEmail: (state, action) => {
      const { email } = action.payload;
      const user = state.list.find(u => u.email === email);
      if (user) {
        user.emailVerified = true;
      }
    },
  },
});

export const { addUser, updateUser, deleteUser, toggleUserStatus, verifyUserEmail } = usersSlice.actions;
export default usersSlice.reducer;
