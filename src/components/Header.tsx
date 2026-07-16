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
    <header className="sticky top-0 z-10 border-b border-natural-border bg-linear-to-r from-natural-heading via-[#16394d] to-natural-heading px-6 py-3 text-white shadow-sm">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/15 bg-white/8 p-1.5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <img
              src="/image.png"
              alt="Logo trung tam"
              className="h-full w-full rounded-xl object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-serif italic text-white">
              {title}
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/65">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-full border border-white/10 bg-white/10 p-1 backdrop-blur-sm w-fit">
          <button
            onClick={onPrevMonth}
            className="rounded-full p-1 text-natural-accent transition-all hover:bg-white/10 hover:shadow-sm"
            id="prev-month-btn"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[120px] text-center font-serif text-base italic capitalize text-white">
            {format(currentDate, 'MMMM, yyyy', { locale: vi })}
          </span>
          <button
            onClick={onNextMonth}
            className="rounded-full p-1 text-natural-accent transition-all hover:bg-white/10 hover:shadow-sm"
            id="next-month-btn"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
