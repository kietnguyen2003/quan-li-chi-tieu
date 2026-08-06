import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Navbar } from './Navbar';

interface HeaderProps {
  currentDate?: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  title?: string;
  subtitle?: string;
  showMonthPicker?: boolean;
}

export function Header({
  currentDate = new Date(),
  onPrevMonth,
  onNextMonth,
  title = 'Chấm công lớp học',
  subtitle = 'Theo dõi lịch dạy & thu nhập',
  showMonthPicker = true,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-natural-border/80 bg-[color:var(--color-natural-overlay)]/95 px-4 py-2 text-white shadow-[0_16px_34px_rgba(15,41,56,0.18)] backdrop-blur-xl sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-xl border border-white/15 bg-white/8 p-0.5 shadow-lg shadow-black/10 backdrop-blur-sm sm:h-10 sm:w-10">
            <img
              src="/image.png"
              alt="Logo trung tâm"
              className="h-full w-full rounded-[0.5rem] object-cover"
            />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/55 sm:text-[9px]">
              Bảng điều khiển
            </p>
            <h1 className="text-base font-bold text-white md:text-lg">
              {title}
            </h1>
            <p className="max-w-md text-xs text-white/72">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Navbar />

          {showMonthPicker && onPrevMonth && onNextMonth && (
            <div className="flex w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-white/8 px-2 py-1 backdrop-blur-sm sm:w-fit sm:justify-start sm:gap-3">
              <button
                onClick={onPrevMonth}
                className="rounded-full p-1.5 text-natural-accent hover:bg-white/10 hover:shadow-sm"
                id="prev-month-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-0 flex-1 text-center font-serif text-xs capitalize leading-none text-white sm:min-w-[120px] sm:flex-none sm:text-sm">
                {format(currentDate, 'MMMM, yyyy', { locale: vi })}
              </span>
              <button
                onClick={onNextMonth}
                className="rounded-full p-1.5 text-natural-accent hover:bg-white/10 hover:shadow-sm"
                id="next-month-btn"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
