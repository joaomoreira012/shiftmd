import { createContext, useContext } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { User } from '@doctor-tracker/shared/types/user';
import { useCurrentUser } from '../../lib/api';

interface AuthContextValue {
  user: User;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <AuthContext value={{ user }}>
      {children}
    </AuthContext>
  );
}
