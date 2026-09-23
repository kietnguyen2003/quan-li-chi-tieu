import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Navbar } from './Navbar';
import { AccountMenu } from './AccountMenu';

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
  showMonthPicker = true,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[color:var(--color-natural-overlay)]/95 px-3 py-2 text-white backdrop-blur-xl sm:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 md:grid-cols-[auto_1fr_auto_auto]">
        <img src="/image.png" alt="Training Camp" className="h-8 w-8 rounded-lg border border-white/15 object-cover" />
        <h1 className="sr-only">{title}</h1>
        <div className="justify-self-center md:justify-self-start"><Navbar /></div>
        <div className="md:col-start-4 md:row-start-1"><AccountMenu /></div>
          {showMonthPicker && onPrevMonth && onNextMonth && (
            <div className="col-span-3 flex items-center justify-between gap-2 rounded-full bg-white/5 px-1 md:col-span-1 md:col-start-3 md:row-start-1 md:min-w-48">
              <button
                onClick={onPrevMonth}
                className="grid h-9 w-9 place-items-center rounded-full text-natural-accent hover:bg-white/10"
                id="prev-month-btn"
                aria-label="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-0 flex-1 text-center font-serif text-xs capitalize leading-none text-white sm:min-w-[120px] sm:flex-none sm:text-sm">
                {format(currentDate, 'MMMM, yyyy', { locale: vi })}
              </span>
              <button
                onClick={onNextMonth}
                className="grid h-9 w-9 place-items-center rounded-full text-natural-accent hover:bg-white/10"
                id="next-month-btn"
                aria-label="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
      </div>
    </header>
  );
}
