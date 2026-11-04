import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // { id, studentId, groupId, date, status: 'present' | 'absent' }
};

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    markAttendance: (state, action) => {
      const { studentId, groupId, date, status } = action.payload;
      const index = state.list.findIndex(a => a.studentId === studentId && a.groupId === groupId && a.date === date);
      if (index !== -1) {
        state.list[index].status = status;
      } else {
        state.list.push({ id: Date.now().toString(), studentId, groupId, date, status });
      }
    },
  },
});

export const { markAttendance } = attendanceSlice.actions;
export default attendanceSlice.reducer;
