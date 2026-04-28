import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type AuthState } from '../lib/types';

interface AuthContextType extends AuthState {
  login: (email: string, fullName: string, userId: string) => boolean;
  logout: () => void;
  isInitializing: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_AUTH = 'pocketkit_auth_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
  });
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        // Simulate token validation logic
        if (parsed.accessToken) {
          setState(parsed);
        }
      } catch (e) {
        console.error('Failed to parse auth session', e);
      }
    }
    setIsInitializing(false);
  }, []);

  const login = (email: string, fullName: string, userId: string) => {
    const newState: AuthState = {
      user: { id: userId, email, fullName },
      accessToken: `simulated-access-token-${userId}-${Date.now()}`,
      refreshToken: `simulated-refresh-token-${userId}-${Date.now()}`,
    };
    setState(newState);
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(newState));
    return true;
  };

  const logout = () => {
    setState({ user: null, accessToken: null, refreshToken: null });
    localStorage.removeItem(STORAGE_KEY_AUTH);
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isInitializing, isAuthenticated: !!state.user && !!state.accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
