import { format, isSameDay, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import type { ClassCheckIn, FixedClassSchedule, TeachingClass } from '../types.ts';
import { formatCurrency } from '../utils.ts';
import { resolveSessionAmount } from '../transaction-helpers.ts';

interface CalendarProps {
  calendarDays: Date[];
  dayCheckIns: Record<string, ClassCheckIn[]>;
  monthStart: Date;
  classes: TeachingClass[];
  fixedClasses: FixedClassSchedule[];
  onSelectDay: (day: Date) => void;
}

export function Calendar({
  calendarDays,
  dayCheckIns,
  monthStart,
  classes,
  fixedClasses,
  onSelectDay,
}: CalendarProps) {
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-natural-border bg-white shadow-xl shadow-natural-heading/5 md:rounded-[2.5rem]">
      <div className="grid grid-cols-7 border-b border-natural-border-light bg-natural-surface/50">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[8px] font-bold uppercase tracking-[0.14em] text-natural-text/40 sm:py-3 sm:text-[9px] sm:tracking-[0.2em]"
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
          const hasFixedClass = fixedClasses.some((fixedClass) => {
            return fixedClass.weekdays.includes(day.getDay());
          });

          return (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={day.toString()}
              onClick={() => onSelectDay(day)}
              className={`
                min-h-[60px] border-r border-b border-natural-border-light p-0.5 md:min-h-[95px] md:p-2 flex flex-col items-center justify-start
                relative transition-all hover:bg-natural-surface/80 group
                ${!isCurrentMonth ? 'bg-natural-bg/30 opacity-30 select-none pointer-events-none' : 'bg-transparent'}
                ${isCurrentMonth && hasFixedClass ? 'bg-[#f5e9b8]/45' : ''}
                ${isToday ? 'after:content-[""] after:absolute after:top-1.5 after:right-1.5 after:w-1.5 after:h-1.5 after:bg-natural-accent after:rounded-full' : ''}
                ${checkIns.length > 0 ? 'bg-natural-surface/30 shadow-inner' : ''}
              `}
            >
              <span
                className={`
                  mb-0.5 text-[11px] font-serif md:mb-1 md:text-base
                  ${!isCurrentMonth ? 'text-natural-text/20' : 'text-natural-text/50'}
                  ${isToday ? 'font-bold text-natural-heading underline decoration-natural-accent underline-offset-2' : ''}
                  group-hover:text-natural-heading transition-colors
                `}
              >
                {format(day, 'd')}
              </span>

              <div className="flex w-full flex-col gap-0.5 overflow-hidden no-scrollbar">
                {checkIns.slice(0, 3).map((checkIn) => {
                  const classItem = classMap.get(checkIn.classId);
                  const lineLabel = checkIn.timeRange
                    ? `${classItem?.name ?? 'Lop da xoa'} • ${checkIn.timeRange}`
                    : classItem?.name ?? 'Lop da xoa';

                  return (
                    <div
                      key={checkIn.id}
                      className="truncate rounded-sm border border-natural-accent/10 bg-natural-accent/5 px-0.5 text-[6px] font-bold text-natural-heading md:px-1 md:text-[9px]"
                      title={lineLabel}
                    >
                      {lineLabel}
                    </div>
                  );
                })}
                {checkIns.length > 0 && (
                  <div className="text-center text-[6px] font-bold text-natural-text/30 md:text-[8px]">
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
    </div>
  );
}
