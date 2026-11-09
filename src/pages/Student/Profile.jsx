import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import TelegramConnect from '../../components/TelegramConnect';

// Student: who I am, and the place to connect the Telegram assistant.
const Profile = () => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);

  return (
    <>
      <PageHeader title={t('profile.title')}>{t('profile.subtitle')}</PageHeader>

      <div className="max-w-2xl space-y-6">
        <dl className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="px-6 py-5">
            <dt className="text-sm text-ink-soft">{t('profile.name')}</dt>
            <dd className="mt-1 font-semibold text-ink">{user?.fullName}</dd>
          </div>
          <div className="px-6 py-5">
            <dt className="text-sm text-ink-soft">{t('profile.email')}</dt>
            <dd className="mt-1 truncate font-semibold text-ink">{user?.email}</dd>
          </div>
        </dl>

        <TelegramConnect />
      </div>
    </>
  );
};

export default Profile;
