import { useDesign } from '../../lib/useDesign';
import CockpitHome from './CockpitHome';
import BaseHome from './BaseHome';
import ConsoleHome from './ConsoleHome';

// The home screen of the design the student has chosen.
const HOMES = { cockpit: CockpitHome, base: BaseHome, console: ConsoleHome };

const StudentHome = () => {
  const Home = HOMES[useDesign()];
  return <Home />;
};

export default StudentHome;
