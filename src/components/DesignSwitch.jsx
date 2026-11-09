import { useTranslation } from 'react-i18next';
import { Rocket, Mountain, SquareTerminal } from 'lucide-react';
import { DESIGNS, chooseDesign } from '../lib/theme';
import { useDesign } from '../lib/useDesign';

const ICONS = { cockpit: Rocket, base: Mountain, console: SquareTerminal };

// Three buttons: a student picks how the site looks and is laid out (not only the colours).
// Staff do not see it: their look is fixed by their role.
const DesignSwitch = () => {
  const { t } = useTranslation();
  const design = useDesign();

  return (
    <div role="group" aria-label={t('design.label')} className="flex items-center gap-1 rounded-lg border border-line bg-card/70 p-0.5">
      {DESIGNS.map((name) => {
        const Icon = ICONS[name];
        return (
          <button
            key={name}
            onClick={() => chooseDesign(name)}
            aria-pressed={design === name}
            title={t(`design.${name}`)}
            aria-label={t(`design.${name}`)}
            className={`flex h-7 w-8 items-center justify-center rounded-md ${
              design === name ? 'bg-mars text-on-accent' : 'text-ink-soft hover:bg-sunken hover:text-ink'
            }`}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};

export default DesignSwitch;
