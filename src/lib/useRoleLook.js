import { useEffect } from 'react';
import { applyRoleLook } from './theme';

// Puts the look of this role on the page while its screens are open.
export const useRoleLook = (role) => {
  useEffect(() => {
    applyRoleLook(role);
  }, [role]);
};
