import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { useLogout } from '../../lib/api';
import { webTokenProvider } from '../../lib/token-provider';
import { useAppStore } from '@doctor-tracker/shared/stores/appStore';

export function Layout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const { theme, setTheme } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: 'D' },
    { to: '/calendar', label: t('nav.calendar'), icon: 'C' },
    { to: '/workplaces', label: t('nav.workplaces'), icon: 'W' },
    { to: '/finance', label: t('nav.finance'), icon: 'F' },
    { to: '/settings', label: t('nav.settings'), icon: 'S' },
  ];

  const handleLogout = async () => {
    const refreshToken = await webTokenProvider.getRefreshToken();
    if (refreshToken) {
      await logout.mutateAsync(refreshToken).catch(() => {});
    }
    await webTokenProvider.clearTokens();
    navigate('/login', { replace: true });
  };

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const themeIcon = theme === 'dark' ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  ) : theme === 'light' ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
    </svg>
  );

  const sidebarContent = (
    <>
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary-600">{t('auth.appName')}</h1>
      </div>
      <nav className="flex-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`
            }
          >
            <span className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle + User section */}
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 capitalize">{t('theme.' + theme)}</span>
          <button
            onClick={cycleTheme}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t('theme.' + theme)}
          >
            {themeIcon}
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
              title={t('auth.signOut')}
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-primary-600">{t('auth.appName')}</h1>
        </div>

        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
