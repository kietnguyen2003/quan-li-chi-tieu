import { Link, Navigate, useLocation } from 'react-router';
import { LoaderCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../auth/useAuth';

export function AuthCallbackPage() {
  const { user, loading, error, isPasswordRecovery } = useAuth();
  const location = useLocation();
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const invalidLink = hash.has('error') || query.has('error');

  if (!invalidLink && !loading && user) {
    return <Navigate to={isPasswordRecovery ? '/reset-password' : '/'} replace />;
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Xác nhận tài khoản.</h1>
      {loading && !invalidLink ? (
        <p className="auth-subtitle flex items-center gap-3" role="status"><LoaderCircle className="motion-safe:animate-spin" size={20} /> Đang xác nhận phiên đăng nhập…</p>
      ) : (
        <>
          <p className="auth-alert" role="alert">{error || 'Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại; nếu cần, hãy yêu cầu một liên kết đặt lại mật khẩu mới.'}</p>
          <Link className="auth-submit" to="/login">Về trang đăng nhập</Link>
        </>
      )}
    </AuthLayout>
  );
}
