import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.tsx';
import type { User } from '../lib/types.ts';
import { useNavigate } from 'react-router';


function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const STORAGE_KEY_USERS = 'pocketkit_users';

    const navigate = useNavigate();

    const handleAuth = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const savedUsersStr = localStorage.getItem(STORAGE_KEY_USERS);
    const savedUsers: User[] = savedUsersStr ? JSON.parse(savedUsersStr) : [];

    if (authMode === 'signup') {
        if (savedUsers.find(u => u.email === email)) {
            setAuthError('Email đã tồn tại');
            return;
        }
        if (!fullName.trim()) {
            setAuthError('Vui lòng nhập họ tên');
            return;
        }
        const newUserId = crypto.randomUUID();
        const newUser: User = { id: newUserId, email, fullName, password };
        const updatedUsers = [...savedUsers, newUser];
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedUsers));
        
        // Simulate server login and token generation via context
        const isLoginSuccess = login(email, fullName, newUserId);
        if (isLoginSuccess) {
            navigate('/app');
        } 

        } else {
            const user = savedUsers.find(u => u.email === email && u.password === password);
            if (!user) {
                setAuthError('Email hoặc mật khẩu không đúng');
                return;
            }
            // Simulate server login and token generation via context
            const isLoginSuccess = login(user.email, user.fullName, user.id);
            if (isLoginSuccess) {
                navigate('/app');
            }
        }
    };
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl border border-natural-border"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl font-serif italic text-natural-heading mb-2">PocketKit</h1>
            <p className="text-natural-text/40 text-xs font-bold uppercase tracking-widest">
              {authMode === 'login' ? 'Đăng nhập vào tài khoản' : 'Tạo tài khoản mới'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {authMode === 'signup' && (
              <div>
                <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-widest block mb-2 px-1">Họ và Tên</label>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full bg-natural-surface rounded-2xl px-6 py-4 outline-none font-medium text-sm border border-natural-border focus:border-natural-heading transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-widest block mb-2 px-1">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-natural-surface rounded-2xl px-6 py-4 outline-none font-medium text-sm border border-natural-border focus:border-natural-heading transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-widest block mb-2 px-1">Mật khẩu</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-natural-surface rounded-2xl px-6 py-4 outline-none font-medium text-sm border border-natural-border focus:border-natural-heading transition-colors"
              />
            </div>

            {authError && <p className="text-natural-warning text-xs font-bold text-center">{authError}</p>}

            <button 
              type="submit"
              className="w-full py-5 bg-natural-accent text-white rounded-2xl font-bold text-lg shadow-xl shadow-natural-accent/20 active:scale-[0.98] transition-all hover:bg-natural-heading"
            >
              {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
              className="text-xs font-bold text-natural-text/40 hover:text-natural-heading transition-colors uppercase tracking-widest"
            >
              {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
        </motion.div>
      </div>
    );
}

export default Login;
