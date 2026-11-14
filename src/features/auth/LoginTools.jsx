import Logo from '../../components/Logo';
import LanguageSwitch from '../../components/LanguageSwitch';
import ThemeToggle from '../../components/ThemeToggle';

// The row along the top of the login screen: the logo, the dark mode button and the language.
const LoginTools = () => (
  <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-10">
    <span className="flex">
      <Logo compact className="sm:hidden" />
      <Logo className="max-sm:hidden" />
    </span>
    <span className="flex items-center gap-4"><ThemeToggle /><LanguageSwitch /></span>
  </div>
);

export default LoginTools;
