import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({
  currentDate,
  onPrevMonth,
  onNextMonth,
  title = 'Chấm công lớp học',
  subtitle = 'Theo dõi lịch dạy',
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-natural-border/80 bg-[color:var(--color-natural-overlay)]/95 px-4 py-3 text-white shadow-[0_16px_34px_rgba(15,41,56,0.18)] backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-11 w-11 overflow-hidden rounded-[1.15rem] border border-white/15 bg-white/8 p-1 shadow-lg shadow-black/10 backdrop-blur-sm sm:h-12 sm:w-12 sm:rounded-[1.35rem] sm:p-1.5">
            <img
              src="/image.png"
              alt="Logo trung tâm"
              className="h-full w-full rounded-[0.95rem] object-cover"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55 sm:text-[10px]">
              Bảng điều khiển
            </p>
            <h1 className="type-heading text-white md:text-[1.9rem]">
              {title}
            </h1>
            <p className="max-w-md text-sm leading-6 text-white/72">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2 rounded-[1.5rem] border border-white/10 bg-white/8 px-2 py-2 backdrop-blur-sm sm:w-fit sm:justify-start sm:gap-4 sm:rounded-full">
          <button
            onClick={onPrevMonth}
            className="rounded-full p-2 text-natural-accent hover:bg-white/10 hover:shadow-sm"
            id="prev-month-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 text-center font-serif text-sm capitalize leading-none text-white sm:min-w-[138px] sm:flex-none sm:text-base">
            {format(currentDate, 'MMMM, yyyy', { locale: vi })}
          </span>
          <button
            onClick={onNextMonth}
            className="rounded-full p-2 text-natural-accent hover:bg-white/10 hover:shadow-sm"
            id="next-month-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
