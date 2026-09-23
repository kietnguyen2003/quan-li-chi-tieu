import { Calendar, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router';

export function Navbar() {
  return (
    <nav aria-label="Điều hướng chính" className="flex items-center justify-center rounded-full bg-white/5 p-0.5">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex items-center min-h-9 gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
            isActive
              ? 'bg-natural-heading text-white shadow-md shadow-black/20'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`
        }
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>Lịch dạy</span>
      </NavLink>

      <NavLink
        to="/statistic"
        className={({ isActive }) =>
          `flex items-center min-h-9 gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
            isActive
              ? 'bg-natural-heading text-white shadow-md shadow-black/20'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`
        }
      >
        <BarChart3 className="w-3.5 h-3.5" />
        <span>Thống kê</span>
      </NavLink>
    </nav>
  );
}
