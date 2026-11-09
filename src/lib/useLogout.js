import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../features/auth/authSlice';
import { applyRoleLook } from './theme';

// Signs out and returns the page to the student's own design (staff looks are not for the login page).
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return () => {
    dispatch(logoutUser());
    applyRoleLook(null);
    navigate('/login');
  };
};
