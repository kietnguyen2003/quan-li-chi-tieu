import { Calendar, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router';

export function Navbar() {
  return (
    <div className="flex items-center justify-center p-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full shadow-inner">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
            isActive
              ? 'bg-natural-heading text-white shadow-md shadow-black/20'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`
        }
      >
        <Calendar className="w-4 h-4" />
        <span>Lịch dạy</span>
      </NavLink>

      <NavLink
        to="/statistic"
        className={({ isActive }) =>
          `flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
            isActive
              ? 'bg-natural-heading text-white shadow-md shadow-black/20'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`
        }
      >
        <BarChart3 className="w-4 h-4" />
        <span>Thống kê</span>
      </NavLink>
    </div>
  );
}
