import { format, isSameDay, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import type { ClassCheckIn, TeachingClass } from '../types.ts';
import { formatCurrency } from '../utils.ts';
import { resolveSessionAmount } from '../transaction-helpers.ts';

export interface PlannedCalendarSession {
  classId: string;
  className: string;
  timeRange: string;
}

interface CalendarProps {
  calendarDays: Date[];
  dayCheckIns: Record<string, ClassCheckIn[]>;
  plannedSessionsByDate: Record<string, PlannedCalendarSession[]>;
  monthStart: Date;
  classes: TeachingClass[];
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
}

export function Calendar({
  calendarDays,
  dayCheckIns,
  plannedSessionsByDate,
  monthStart,
  classes,
  selectedDay,
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
          const plannedSessions = plannedSessionsByDate[dateKey] ?? [];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
          const previewCheckIns = checkIns.slice(0, 2);
          const remainingSlots = Math.max(0, 2 - previewCheckIns.length);
          const previewPlannedSessions = plannedSessions.slice(0, remainingSlots);
          const hiddenCount = Math.max(
            0,
            checkIns.length + plannedSessions.length - previewCheckIns.length - previewPlannedSessions.length,
          );
          const totalAmount = checkIns.reduce((total, checkIn) => {
            const classItem = classMap.get(checkIn.classId);
            return total + resolveSessionAmount(checkIn, classItem);
          }, 0);

          return (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={day.toString()}
              onClick={() => onSelectDay(day)}
              className={`
                group relative flex min-h-[78px] flex-col items-start justify-start border-r border-b border-natural-border-light p-1.5 text-left transition-all hover:bg-white/90 md:min-h-[118px] md:p-3
                ${!isCurrentMonth ? 'pointer-events-none bg-natural-bg/35 opacity-30 select-none' : 'bg-white/55'}
                ${isSelected ? 'bg-natural-surface ring-2 ring-inset ring-natural-heading/70' : ''}
                ${!isSelected && isToday ? 'ring-1 ring-inset ring-natural-accent/60' : ''}
                ${checkIns.length > 0 ? 'bg-natural-panel shadow-inner shadow-natural-heading/5' : ''}
              `}
            >
              <span
                className={`
                  mb-1 inline-flex min-w-[1.8rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-serif md:text-base
                  ${!isCurrentMonth ? 'text-natural-text/20' : 'text-natural-text/55'}
                  ${isSelected ? 'bg-natural-heading text-white' : ''}
                  ${!isSelected && isToday ? 'text-natural-heading' : ''}
                  ${!isSelected ? 'group-hover:text-natural-heading' : ''}
                `}
              >
                {format(day, 'd')}
              </span>

              <div className="flex w-full min-w-0 flex-col gap-1 overflow-hidden no-scrollbar">
                {previewCheckIns.map((checkIn) => {
                  const classItem = classMap.get(checkIn.classId);
                  const lineLabel = classItem?.name ?? 'Lớp đã xóa';

                  return (
                    <div
                      key={checkIn.id}
                      className="truncate rounded-full border border-natural-border bg-white/95 px-1.5 py-0.5 text-[6.5px] font-bold text-natural-heading md:px-2 md:py-1 md:text-[8px]"
                      title={lineLabel}
                    >
                      {lineLabel}
                    </div>
                  );
                })}
                {previewPlannedSessions.map((session) => (
                  <div
                    key={`${session.classId}-${session.timeRange}`}
                    className="truncate rounded-full border border-dashed border-natural-accent/45 bg-natural-accent/10 px-1.5 py-0.5 text-[6.5px] font-bold text-natural-heading/80 md:px-2 md:py-1 md:text-[8px]"
                    title={`${session.className} (${session.timeRange})`}
                  >
                    {session.className}
                  </div>
                ))}
                {hiddenCount > 0 ? (
                  <div className="truncate rounded-full border border-dashed border-natural-border bg-white/80 px-1.5 py-0.5 text-[6.5px] font-bold text-natural-text/65 md:px-2 md:py-1 md:text-[8px]">
                    {checkIns.length + plannedSessions.length} lớp
                  </div>
                ) : null}
                {checkIns.length > 0 && (
                  <div className="text-[8px] font-semibold text-natural-heading/70 md:text-[9px]">
                    {formatCurrency(totalAmount).replace(' ₫', '').replace(' ₫', '')}
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
