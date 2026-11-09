import { useFetch } from '../../lib/useFetch';
import { StudentHomeContext } from './homeContext';

const StudentHomeProvider = ({ children }) => {
  const home = useFetch('/api/home/student');
  return <StudentHomeContext.Provider value={home}>{children}</StudentHomeContext.Provider>;
};

export default StudentHomeProvider;
