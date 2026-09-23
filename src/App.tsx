import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AttendanceProvider } from './context/AttendanceContext';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { AttendanceBoundary } from './components/AttendanceBoundary';

const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const StatisticPage = lazy(() => import('./pages/StatisticPage').then((module) => ({ default: module.StatisticPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })));

function AppRoutes() {
  const { user, loading, error, retrySession, isPasswordRecovery } = useAuth();
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback'].includes(location.pathname);

  if (isPasswordRecovery && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />;
  if (!isAuthPage && loading) return <main className="grid min-h-screen place-items-center text-natural-heading"><p role="status">Đang tải tài khoản…</p></main>;
  if (!isAuthPage && error) return <main className="mx-auto max-w-md p-8 text-natural-heading"><p role="alert">{error}</p><button className="hallmark-button-primary mt-4" onClick={() => void retrySession()}>Thử lại</button></main>;

  return (
      <Routes>
        <Route element={<AttendanceProvider key={user?.id ?? 'guest'} storageScope={user?.id}><AttendanceBoundary><Outlet /></AttendanceBoundary></AttendanceProvider>}>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/statistic" element={<StatisticPage />} />
          <Route path="/thong-ke" element={<StatisticPage />} />
        </Route>
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Suspense fallback={<p className="p-8 text-natural-heading" role="status">Đang tải…</p>}><AppRoutes /></Suspense></AuthProvider>
    </BrowserRouter>
  );
}
