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
    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-natural-heading/5 border border-natural-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-natural-border-light bg-natural-surface/50">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[9px] font-bold text-natural-text/40 uppercase tracking-[0.2em]"
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
                min-h-[70px] md:min-h-[95px] p-1 md:p-2 border-r border-b border-natural-border-light flex flex-col items-center justify-start
                relative transition-all hover:bg-natural-surface/80 group
                ${!isCurrentMonth ? 'bg-natural-bg/30 opacity-30 select-none pointer-events-none' : 'bg-transparent'}
                ${isCurrentMonth && hasFixedClass ? 'bg-[#f5e9b8]/45' : ''}
                ${isToday ? 'after:content-[""] after:absolute after:top-1.5 after:right-1.5 after:w-1.5 after:h-1.5 after:bg-natural-accent after:rounded-full' : ''}
                ${checkIns.length > 0 ? 'bg-natural-surface/30 shadow-inner' : ''}
              `}
            >
              <span
                className={`
                  text-xs md:text-base font-serif mb-1
                  ${!isCurrentMonth ? 'text-natural-text/20' : 'text-natural-text/50'}
                  ${isToday ? 'font-bold text-natural-heading underline decoration-natural-accent underline-offset-2' : ''}
                  group-hover:text-natural-heading transition-colors
                `}
              >
                {format(day, 'd')}
              </span>

              <div className="w-full flex flex-col gap-0.5 overflow-hidden no-scrollbar">
                {checkIns.slice(0, 3).map((checkIn) => {
                  const classItem = classMap.get(checkIn.classId);
                  const lineLabel = checkIn.timeRange
                    ? `${classItem?.name ?? 'Lop da xoa'} • ${checkIn.timeRange}`
                    : classItem?.name ?? 'Lop da xoa';

                  return (
                    <div
                      key={checkIn.id}
                      className="text-[7px] md:text-[9px] font-bold truncate px-1 rounded-sm border text-natural-heading bg-natural-accent/5 border-natural-accent/10"
                      title={lineLabel}
                    >
                      {lineLabel}
                    </div>
                  );
                })}
                {checkIns.length > 0 && (
                  <div className="text-[6px] md:text-[8px] text-natural-text/30 text-center font-bold">
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
