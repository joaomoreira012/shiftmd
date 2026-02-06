import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useGCalStatus, useGCalAuthUrl, useGCalCallback, useGCalSync, useGCalDisconnect } from '../lib/api';

export function SettingsPage() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('settings.profile')}</h2>
          <p className="text-gray-500 text-sm">{t('settings.profileDesc')}</p>
        </div>

        {/* Tax Configuration */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('settings.taxConfig')}</h2>
          <p className="text-gray-500 text-sm">{t('settings.taxConfigDesc')}</p>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('settings.language')}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => { i18n.changeLanguage('en'); localStorage.setItem('doctor-tracker-lang', 'en'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${i18n.language === 'en' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => { i18n.changeLanguage('pt'); localStorage.setItem('doctor-tracker-lang', 'pt'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${i18n.language === 'pt' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('settings.portuguese')}
            </button>
          </div>
        </div>

        {/* Google Calendar */}
        <GoogleCalendarSection />
      </div>
    </div>
  );
}

function GoogleCalendarSection() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status, isLoading } = useGCalStatus();
  const getAuthUrl = useGCalAuthUrl();
  const callback = useGCalCallback();
  const sync = useGCalSync();
  const disconnect = useGCalDisconnect();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Handle OAuth callback code from URL (Google redirects with ?code=xxx)
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !callback.isPending && !callback.isSuccess) {
      callback.mutate(code, {
        onSuccess: () => toast.success('Google Calendar connected!'),
        onError: () => toast.error('Failed to connect Google Calendar'),
        onSettled: () => {
          searchParams.delete('code');
          searchParams.delete('state');
          searchParams.delete('scope');
          setSearchParams(searchParams, { replace: true });
        },
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const handleConnect = async () => {
    getAuthUrl.mutate(undefined, {
      onSuccess: (data) => {
        // Open Google OAuth in the same window
        window.location.href = data.url;
      },
    });
  };

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: (data) => toast.success(`Sync complete: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`),
      onError: () => toast.error('Sync failed'),
    });
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        setShowDisconnectConfirm(false);
        toast.success('Google Calendar disconnected');
      },
      onError: () => toast.error('Failed to disconnect'),
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">{t('settings.googleCalendar')}</h2>
        <div className="animate-pulse h-10 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">{t('settings.googleCalendar')}</h2>

      {callback.isPending && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
          {t('settings.connecting')}
        </div>
      )}

      {status?.connected ? (
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('settings.connected')}</span>
            {status.calendar_id && (
              <span className="text-xs text-gray-400 ml-2">({status.calendar_id})</span>
            )}
          </div>

          {/* Last sync */}
          {status.last_sync && (
            <p className="text-xs text-gray-500">
              {t('settings.lastSynced', { date: new Date(status.last_sync).toLocaleString() })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={sync.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {sync.isPending ? t('settings.syncing') : t('settings.syncNow')}
            </button>

            {showDisconnectConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{t('settings.confirmDisconnect')}</span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {disconnect.isPending ? t('settings.disconnecting') : t('settings.yesDisconnect')}
                </button>
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-medium"
              >
                {t('settings.disconnect')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {t('settings.connectGoogleDesc')}
          </p>
          <button
            onClick={handleConnect}
            disabled={getAuthUrl.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {getAuthUrl.isPending ? t('settings.connecting') : t('settings.connectGoogle')}
          </button>
        </div>
      )}
    </div>
  );
}
