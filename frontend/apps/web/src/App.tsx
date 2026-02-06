import { Routes, Route, Navigate } from 'react-router';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/AuthProvider';
import { LoginPage } from './routes/login';
import { DashboardPage } from './routes/dashboard';
import { CalendarPage } from './routes/calendar';
import { WorkplacesPage } from './routes/workplaces';
import { WorkplaceDetailPage } from './routes/workplace-detail';
import { FinancePage } from './routes/finance';
import { SettingsPage } from './routes/settings';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/workplaces" element={<WorkplacesPage />} />
        <Route path="/workplaces/:id" element={<WorkplaceDetailPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
