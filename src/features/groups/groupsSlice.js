import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [],
};

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    addGroup: (state, action) => {
      state.list.push(action.payload);
    },
    updateGroup: (state, action) => {
      const { id, updatedData } = action.payload;
      const index = state.list.findIndex(g => g.id === id);
      if (index !== -1) {
        state.list[index] = { ...state.list[index], ...updatedData };
      }
    },
    deleteGroup: (state, action) => {
      state.list = state.list.filter(g => g.id !== action.payload);
    },
  },
});

export const { addGroup, updateGroup, deleteGroup } = groupsSlice.actions;
export default groupsSlice.reducer;
