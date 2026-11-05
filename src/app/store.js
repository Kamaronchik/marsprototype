import { configureStore } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import groupsReducer from '../features/groups/groupsSlice';
import attendanceReducer from '../features/attendance/attendanceSlice';
import paymentsReducer from '../features/payments/paymentsSlice';
import announcementsReducer from '../features/announcements/announcementsSlice';
import settingsReducer from '../features/settings/settingsSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  users: usersReducer,
  groups: groupsReducer,
  attendance: attendanceReducer,
  payments: paymentsReducer,
  announcements: announcementsReducer,
  settings: settingsReducer,
});

// Fix for "storage.getItem is not a function" error in Vite
const storageAdapter = storage.default || storage;

const persistConfig = {
  key: 'root-v2', // new key: old cached data (mock admin) is ignored
  version: 1,
  storage: storageAdapter,
  // auth is NOT persisted: the server session (cookie) is the source of truth
  whitelist: ['groups', 'attendance', 'payments', 'announcements', 'settings'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
