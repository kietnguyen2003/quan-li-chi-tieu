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
  title = 'Class Check-in',
  subtitle = 'Theo doi lich day',
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-natural-border bg-linear-to-r from-natural-heading via-[#16394d] to-natural-heading px-4 py-2.5 text-white shadow-sm sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-4xl flex-col justify-between gap-2 sm:gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-[1.15rem] border border-white/15 bg-white/8 p-1 shadow-lg shadow-black/10 backdrop-blur-sm sm:h-12 sm:w-12 sm:rounded-2xl sm:p-1.5">
            <img
              src="/image.png"
              alt="Logo trung tam"
              className="h-full w-full rounded-xl object-cover"
            />
          </div>
          <div>
            <h1 className="text-lg font-serif italic text-white sm:text-xl md:text-2xl">
              {title}
            </h1>
            <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/65 sm:text-[9px] sm:tracking-widest">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-1 py-1 backdrop-blur-sm sm:gap-4 sm:p-1">
          <button
            onClick={onPrevMonth}
            className="rounded-full p-1 text-natural-accent transition-all hover:bg-white/10 hover:shadow-sm"
            id="prev-month-btn"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[108px] text-center font-serif text-sm italic capitalize text-white sm:min-w-[120px] sm:text-base">
            {format(currentDate, 'MMMM, yyyy', { locale: vi })}
          </span>
          <button
            onClick={onNextMonth}
            className="rounded-full p-1 text-natural-accent transition-all hover:bg-white/10 hover:shadow-sm"
            id="next-month-btn"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
