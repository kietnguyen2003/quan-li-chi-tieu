import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../auth/useAuth';
import { getAuthErrorMessage, safeReturnPath, validateAuthForm, type AuthMode } from '../auth/auth-utils';
import { supabase } from '../service/supabase/create-client';

const copy = {
  login: { title: 'Chào mừng trở lại.', subtitle: 'Đăng nhập để tiếp tục chăm chút cho từng buổi dạy.', action: 'Đăng nhập' },
  register: { title: 'Bắt đầu cùng Training Camp.', subtitle: 'Tạo tài khoản của bạn. Một lịch dạy ngăn nắp bắt đầu từ đây.', action: 'Tạo tài khoản' },
  forgot: { title: 'Quên mật khẩu?', subtitle: 'Nhập email tài khoản. Chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.', action: 'Gửi liên kết đặt lại' },
  reset: { title: 'Một mật khẩu mới.', subtitle: 'Chọn mật khẩu mới để tiếp tục sử dụng tài khoản của bạn.', action: 'Lưu mật khẩu mới' },
};

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, loading, error: sessionError, clearPasswordRecovery, isPasswordRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('next'));
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const content = copy[mode];
  const isRegistration = mode === 'register';
  const hasPassword = mode !== 'forgot';
  const noResetSession = mode === 'reset' && !loading && !user;

  async function cancelRecovery() {
    setBusy(true);
    setError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(getAuthErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const change = (field: keyof typeof values, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setError('');
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading) return;
    const validationError = validateAuthForm(mode, values);
    if (validationError) { setError(validationError); return; }
    if (!supabase) { setError('Đăng nhập chưa được thiết lập. Bạn có thể tiếp tục dùng lịch dạy không đăng nhập.'); return; }
    setBusy(true);
    setError('');
    setSuccess('');
    const email = values.email.trim();
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password: values.password });
        if (authError) throw authError;
        navigate(returnTo, { replace: true });
      } else if (mode === 'register') {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password: values.password,
          options: { data: { full_name: values.name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) navigate(returnTo, { replace: true });
        else setSuccess('Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập. Nếu đã có tài khoản, bạn có thể đăng nhập hoặc đặt lại mật khẩu.');
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (authError) throw authError;
        setSuccess('Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư mục thư rác.');
      } else {
        if (!user) throw new Error('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        const { error: authError } = await supabase.auth.updateUser({ password: values.password });
        if (authError) throw authError;
        clearPasswordRecovery();
        setSuccess('Đã cập nhật mật khẩu. Bạn có thể trở về lịch dạy.');
      }
      setValues((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  if (!loading && user && !busy && (mode === 'login' || mode === 'register')) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <AuthLayout>
      {(mode === 'login' || mode === 'register') && (
        <nav className="auth-tabs" aria-label="Tài khoản">
          <Link to={`/login?next=${encodeURIComponent(returnTo)}`} aria-current={mode === 'login' ? 'page' : undefined}>Đăng nhập</Link>
          <Link to={`/register?next=${encodeURIComponent(returnTo)}`} aria-current={isRegistration ? 'page' : undefined}>Đăng ký</Link>
        </nav>
      )}
      <h1 className="auth-title">{content.title}</h1>
      <p className="auth-subtitle">{content.subtitle}</p>
      {(error || sessionError) && <div id="auth-error" className="auth-alert" role="alert">{error || sessionError}</div>}
      {!supabase && <div className="auth-alert" role="status">Tính năng tài khoản chưa được thiết lập. Bạn vẫn có thể sử dụng lịch dạy không đăng nhập.</div>}
      {noResetSession && <div className="auth-alert" role="alert">Hãy mở liên kết đặt lại mật khẩu trong email. <Link className="auth-text-link" to="/forgot-password">Gửi liên kết mới</Link></div>}
      {success ? (
        <div>
          <div className="auth-alert auth-success" role="status">{success}</div>
          <Link className="auth-submit" to={mode === 'reset' ? '/' : '/login'}>{mode === 'reset' ? 'Về lịch dạy' : 'Về trang đăng nhập'}<ArrowRight size={16} /></Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-describedby={error || sessionError ? 'auth-error' : undefined} aria-busy={busy}>
          {isRegistration && <div className="auth-field"><label htmlFor="auth-name">Họ và tên</label><input id="auth-name" autoComplete="name" placeholder="Tên của bạn" value={values.name} onChange={(event) => change('name', event.target.value)} maxLength={100} required disabled={busy} /></div>}
          {mode !== 'reset' && <div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="ban@example.com" value={values.email} onChange={(event) => change('email', event.target.value)} required disabled={busy} /></div>}
          {hasPassword && <div className="auth-field">
            <label htmlFor="auth-password">Mật khẩu</label>
            <div className="auth-password"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Nhập mật khẩu của bạn' : 'Tối thiểu 8 ký tự'} value={values.password} onChange={(event) => change('password', event.target.value)} required disabled={busy} aria-describedby={mode !== 'login' ? 'password-hint' : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            {mode !== 'login' && <p id="password-hint" className="auth-field-hint">Dùng ít nhất 8 ký tự để bảo vệ tài khoản.</p>}
          </div>}
          {(isRegistration || mode === 'reset') && <div className="auth-field"><label htmlFor="auth-confirm">Nhập lại mật khẩu</label><input id="auth-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu vừa tạo" value={values.confirmPassword} onChange={(event) => change('confirmPassword', event.target.value)} required disabled={busy} /></div>}
          {mode === 'login' && <Link className="auth-text-link self-end" to="/forgot-password">Quên mật khẩu?</Link>}
          <button className="auth-submit" type="submit" disabled={busy || loading || !supabase || noResetSession}>{busy || loading ? <LoaderCircle className="motion-safe:animate-spin" size={17} /> : null}{busy ? 'Đang xử lý…' : content.action}{!busy && <ArrowRight size={16} />}</button>
        </form>
      )}
      {(mode === 'forgot' || mode === 'reset') && !success && !isPasswordRecovery && <Link className="auth-guest" to="/login">Về trang đăng nhập</Link>}
      <div className="auth-divider">hoặc</div>
      {isPasswordRecovery ? <button type="button" className="auth-guest w-full" onClick={cancelRecovery} disabled={busy}>Hủy đặt lại mật khẩu và đăng xuất</button> : <Link className="auth-guest" to="/">Tiếp tục không đăng nhập <ArrowRight size={14} /></Link>}
    </AuthLayout>
  );
}
