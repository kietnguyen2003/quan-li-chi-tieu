import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function Header({ currentDate, onPrevMonth, onNextMonth }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-natural-border px-6 py-3 md:py-4 sticky top-0 z-10 shadow-sm">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-serif italic text-natural-heading">
            KitDev
          </h1>
          <p className="text-natural-text/40 text-[9px] font-bold uppercase tracking-widest">
            Xin chào{' '}
            <span className="text-natural-accent text-[11px] font-extrabold">
              {user?.fullName ?? 'bạn'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 bg-natural-surface p-1 rounded-full border border-natural-border w-fit">
            <button
              onClick={onPrevMonth}
              className="p-1 hover:bg-white hover:shadow-sm rounded-full transition-all text-natural-heading"
              id="prev-month-btn"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-serif italic text-base min-w-[120px] text-center capitalize text-natural-heading">
              {format(currentDate, 'MMMM, yyyy', { locale: vi })}
            </span>
            <button
              onClick={onNextMonth}
              className="p-1 hover:bg-white hover:shadow-sm rounded-full transition-all text-natural-heading"
              id="next-month-btn"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-natural-border bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-natural-text/50 transition-all hover:border-natural-warning hover:text-natural-warning hover:shadow-sm"
            title="Đăng xuất"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
