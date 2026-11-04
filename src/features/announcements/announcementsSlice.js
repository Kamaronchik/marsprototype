import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // { id, title, content, date, targetRole: 'All' | 'Student' | 'Teacher' | 'Financier' }
};

const announcementsSlice = createSlice({
  name: 'announcements',
  initialState,
  reducers: {
    addAnnouncement: (state, action) => {
      state.list.push(action.payload);
    },
    deleteAnnouncement: (state, action) => {
      state.list = state.list.filter(a => a.id !== action.payload);
    },
  },
});

export const { addAnnouncement, deleteAnnouncement } = announcementsSlice.actions;
export default announcementsSlice.reducer;
