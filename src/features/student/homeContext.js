import { createContext, useContext } from 'react';

// The numbers of the student home screen (rank, coins, next launch, log), loaded once and shared by
// the shell (status bar, HUD) and the home page.
export const StudentHomeContext = createContext(null);

export const useStudentHome = () => useContext(StudentHomeContext);
