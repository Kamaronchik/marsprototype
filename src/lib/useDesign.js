import { useSyncExternalStore } from 'react';
import { DEFAULT_DESIGN, savedDesign, subscribeToDesign } from './theme';

// The design a student has chosen. Screens that depend on it redraw when it changes.
export const useDesign = () => useSyncExternalStore(subscribeToDesign, savedDesign, () => DEFAULT_DESIGN);
