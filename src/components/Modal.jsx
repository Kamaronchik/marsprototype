import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// The same dialog window everywhere. Pass size="lg" for wide forms.
const Modal = ({ title, onClose, children, size = 'md' }) => {
  const { t } = useTranslation();
  const width = size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" className={`w-full ${width} rounded-2xl border border-line bg-card shadow-xl`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
