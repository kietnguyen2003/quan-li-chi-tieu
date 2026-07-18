import { format, isSameDay, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import type { ClassCheckIn, TeachingClass } from '../types.ts';
import { formatCurrency } from '../utils.ts';
import { resolveSessionAmount } from '../transaction-helpers.ts';

interface CalendarProps {
  calendarDays: Date[];
  dayCheckIns: Record<string, ClassCheckIn[]>;
  monthStart: Date;
  classes: TeachingClass[];
  onSelectDay: (day: Date) => void;
}

export function Calendar({
  calendarDays,
  dayCheckIns,
  monthStart,
  classes,
  onSelectDay,
}: CalendarProps) {
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  return (
    <section className="hallmark-panel overflow-hidden md:rounded-[2.5rem]">
      <div className="grid grid-cols-7 border-b border-natural-border-light bg-natural-panel-strong/70">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[8px] font-bold uppercase tracking-[0.18em] text-natural-text/45 sm:py-4 sm:text-[9px] sm:tracking-[0.24em]"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const checkIns = dayCheckIns[dateKey] ?? [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={day.toString()}
              onClick={() => onSelectDay(day)}
              className={`
                group relative flex min-h-[78px] flex-col items-start justify-start border-r border-b border-natural-border-light p-1.5 text-left transition-all hover:bg-white/90 md:min-h-[118px] md:p-3
                ${!isCurrentMonth ? 'pointer-events-none bg-natural-bg/35 opacity-30 select-none' : 'bg-white/55'}
                ${isToday ? 'ring-1 ring-inset ring-natural-accent/60' : ''}
                ${checkIns.length > 0 ? 'bg-natural-panel shadow-inner shadow-natural-heading/5' : ''}
              `}
            >
              <span
                className={`
                  mb-1 inline-flex min-w-[1.8rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-serif md:text-base
                  ${!isCurrentMonth ? 'text-natural-text/20' : 'text-natural-text/55'}
                  ${isToday ? 'bg-natural-heading text-white' : 'group-hover:text-natural-heading'}
                `}
              >
                {format(day, 'd')}
              </span>

              <div className="flex w-full min-w-0 flex-col gap-1 overflow-hidden no-scrollbar">
                {checkIns.slice(0, 3).map((checkIn) => {
                  const classItem = classMap.get(checkIn.classId);
                  const lineLabel = checkIn.timeRange
                    ? `${classItem?.name ?? 'Lop da xoa'} • ${checkIn.timeRange}`
                    : classItem?.name ?? 'Lop da xoa';

                  return (
                    <div
                      key={checkIn.id}
                      className="truncate rounded-full border border-natural-border bg-white/95 px-1.5 py-1 text-[7px] font-bold text-natural-heading md:text-[9px]"
                      title={lineLabel}
                    >
                      {lineLabel}
                    </div>
                  );
                })}
                {checkIns.length > 0 && (
                  <div className="pt-0.5 text-[7px] font-bold uppercase tracking-[0.16em] text-natural-text/36 md:text-[8px]">
                    {formatCurrency(
                      checkIns.reduce((total, checkIn) => {
                        const classItem = classMap.get(checkIn.classId);
                        const sessionAmount = resolveSessionAmount(checkIn, classItem);

                        return total + sessionAmount;
                      }, 0),
                    ).replace(' ₫', '').replace(' ₫', '')}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
