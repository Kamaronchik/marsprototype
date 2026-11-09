import { useDesign } from '../../lib/useDesign';
import { useRoleLook } from '../../lib/useRoleLook';
import LoginForm from './LoginForm';
import CockpitStage from './CockpitStage';
import BaseStage from './BaseStage';
import ConsoleStage from './ConsoleStage';

// Three stages for the same form: the cockpit, the base at night and the console.
const STAGES = { cockpit: CockpitStage, base: BaseStage, console: ConsoleStage };

const LoginPage = () => {
  useRoleLook(null);
  const Stage = STAGES[useDesign()];

  return (
    <Stage>
      <LoginForm />
    </Stage>
  );
};

export default LoginPage;
