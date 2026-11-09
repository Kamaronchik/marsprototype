import Logo from '../../components/Logo';
import LanguageSwitch from '../../components/LanguageSwitch';
import DesignSwitch from '../../components/DesignSwitch';

// The row along the top of every login screen: the logo, the three designs and the language.
// onLightText: the screen has a dark sky behind a light theme, so the logo turns light and the
// switches sit on a light pill to stay readable.
const LoginTools = ({ onLightText = false }) => (
  <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-10">
    <span className="flex">
      <Logo compact inverted={onLightText} className="sm:hidden" />
      <Logo inverted={onLightText} className="max-sm:hidden" />
    </span>
    <span className={`flex items-center gap-4 ${onLightText ? 'rounded-xl bg-card/90 px-3 py-1.5' : ''}`}><DesignSwitch /><LanguageSwitch /></span>
  </div>
);

export default LoginTools;
