import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // { id, studentId, amount, date, status: 'Paid' | 'Pending' | 'Overdue' }
};

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    addPayment: (state, action) => {
      state.list.push(action.payload);
    },
    updatePayment: (state, action) => {
      const { id, updatedData } = action.payload;
      const index = state.list.findIndex(p => p.id === id);
      if (index !== -1) {
        state.list[index] = { ...state.list[index], ...updatedData };
      }
    },
  },
});

export const { addPayment, updatePayment } = paymentsSlice.actions;
export default paymentsSlice.reducer;
