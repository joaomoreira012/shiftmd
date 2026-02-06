import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { Layout } from './Layout';

// Mock AuthProvider
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: '1', full_name: 'Test Doctor', email: 'test@example.com' },
  }),
}));

// Mock useLogout
vi.mock('../../lib/api', () => ({
  useLogout: () => ({ mutateAsync: vi.fn() }),
}));

// Mock webTokenProvider
vi.mock('../../lib/token-provider', () => ({
  webTokenProvider: {
    getRefreshToken: vi.fn().mockResolvedValue(null),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('renders navigation items', () => {
    renderLayout();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Workplaces')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the app name', () => {
    renderLayout();

    expect(screen.getAllByText('Doctor Tracker').length).toBeGreaterThan(0);
  });

  it('renders user info', () => {
    renderLayout();

    expect(screen.getAllByText('Test Doctor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0);
  });

  it('renders navigation items in Portuguese when language is pt', async () => {
    await i18n.changeLanguage('pt');
    renderLayout();

    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(screen.getByText('Calendario')).toBeInTheDocument();
    expect(screen.getByText('Locais')).toBeInTheDocument();
    expect(screen.getByText('Financas')).toBeInTheDocument();
    expect(screen.getByText('Definicoes')).toBeInTheDocument();
  });
});
