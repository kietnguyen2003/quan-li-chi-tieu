import { useState } from 'react';
import { LogIn, LogOut, LoaderCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { getAuthErrorMessage } from '../auth/auth-utils';

export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
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

  if (loading) return <span className="grid h-9 w-9 place-items-center text-white/70" role="status" aria-label="Đang tải tài khoản"><LoaderCircle size={16} className="motion-safe:animate-spin" /></span>;
  if (!user) return <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} aria-label="Đăng nhập" title="Đăng nhập" className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10"><LogIn size={17} /></Link>;

  const name = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : user.email;
  return (
    <div className="relative flex items-center gap-2">
      <button type="button" onClick={handleSignOut} disabled={busy} aria-label={busy ? 'Đang thoát…' : 'Đăng xuất'} title={`Đăng xuất${name ? ` · ${name}` : ''}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 disabled:opacity-50"><LogOut size={17} /></button>
      {error && <p role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-natural-border bg-natural-surface p-3 text-xs text-natural-heading shadow-lg">{error}</p>}
    </div>
  );
}
