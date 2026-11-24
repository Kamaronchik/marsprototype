import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, BellOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { pushAvailable, pushPermission, enablePush } from '../lib/push';

// One button in the top bar: turn on push notifications in this browser (penalties come as a push).
// Hidden when the browser cannot do pushes or Firebase is not set up.
const PushButton = () => {
  const { t, i18n } = useTranslation();
  const [available, setAvailable] = useState(false);
  const [permission, setPermission] = useState(pushPermission());
  const [busy, setBusy] = useState(false);
  const language = i18n.language?.slice(0, 2);

  useEffect(() => {
    pushAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  // Already allowed: give the server a fresh token (tokens change) and the current language, quietly.
  useEffect(() => {
    if (available && pushPermission() === 'granted') enablePush(language).catch(() => {});
  }, [available, language]);

  if (!available) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enablePush(language);
      setPermission(result);
      if (result === 'granted') toast.success(t('push.enabled'));
      if (result === 'denied') toast.info(t('push.blocked'));
    } catch {
      toast.error(t('push.failed'));
    } finally {
      setBusy(false);
    }
  };

  const label = permission === 'granted' ? t('push.on') : permission === 'denied' ? t('push.blocked') : t('push.turnOn');

  return (
    <button
      onClick={turnOn}
      disabled={busy || permission !== 'default'}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card hover:bg-sunken disabled:cursor-default disabled:hover:bg-card ${
        permission === 'default' ? 'text-mars' : 'text-ink-faint'
      }`}
    >
      {permission === 'denied' ? <BellOff size={16} /> : <BellRing size={16} />}
    </button>
  );
};

export default PushButton;
