import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../features/auth/authSlice';

// Signs out and goes to the login page.
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return () => {
    dispatch(logoutUser());
    navigate('/login');
  };
};
