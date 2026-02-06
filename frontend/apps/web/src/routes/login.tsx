import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useLogin, useRegister } from '../lib/api';
import { webTokenProvider } from '../lib/token-provider';

export function LoginPage() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const login = useLogin();
  const register = useRegister();

  const isPending = login.isPending || register.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const data = await login.mutateAsync({ email, password });
        await webTokenProvider.setTokens(data.tokens.access_token, data.tokens.refresh_token);
      } else {
        const data = await register.mutateAsync({ email, password, full_name: fullName });
        await webTokenProvider.setTokens(data.tokens.access_token, data.tokens.refresh_token);
      }
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('auth.authFailed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2 text-primary-600">{t('auth.appName')}</h1>
        <p className="text-center text-gray-500 mb-8">
          {isLogin ? t('auth.signIn') : t('auth.createAccount')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-700"
                required
                disabled={isPending}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-700"
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-700"
              required
              minLength={8}
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? t('auth.pleaseWait') : isLogin ? t('auth.signInBtn') : t('auth.createAccountBtn')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? t('auth.noAccount') + ' ' : t('auth.hasAccount') + ' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-600 font-medium hover:underline"
          >
            {isLogin ? t('auth.signUp') : t('auth.signInLink')}
          </button>
        </p>
      </div>
    </div>
  );
}
