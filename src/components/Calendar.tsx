import { format, isSameDay, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';
import type { Transaction } from '../lib/types';
import { formatCurrency } from '../lib/utils';

interface CalendarProps {
  calendarDays: Date[];
  dayTransactions: Record<string, Transaction[]>;
  monthStart: Date;
  onSelectDay: (day: Date) => void;
}

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function Calendar({
  calendarDays,
  dayTransactions,
  monthStart,
  onSelectDay,
}: CalendarProps) {
  return (
    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-natural-heading/5 border border-natural-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-natural-border-light bg-natural-surface/50">
        {weekDays.map((day) => (
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
          const transactions = dayTransactions[dateKey] ?? [];
          const hasTransactions = transactions.length > 0;
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={day.toString()}
              onClick={() => onSelectDay(day)}
              className={`
                min-h-[70px] md:min-h-[95px] p-1 md:p-2 border-r border-b border-natural-border-light flex flex-col items-center justify-start
                relative transition-all hover:bg-natural-surface/80 group
                ${!isCurrentMonth ? 'bg-natural-bg/30 opacity-30 select-none pointer-events-none' : 'bg-transparent'}
                ${isToday ? 'after:content-[""] after:absolute after:top-1.5 after:right-1.5 after:w-1.5 after:h-1.5 after:bg-natural-accent after:rounded-full' : ''}
                ${hasTransactions ? 'bg-natural-surface/30 shadow-inner' : ''}
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
                {transactions.slice(0, 3).map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`
                      text-[7px] md:text-[9px] font-bold truncate px-1 rounded-sm border
                      ${transaction.type === 'income' ? 'text-natural-accent bg-natural-accent/5 border-natural-accent/10' : 'text-natural-warning bg-natural-warning/5 border-natural-warning/10'}
                    `}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </div>
                ))}
                {transactions.length > 3 && (
                  <div className="text-[6px] md:text-[8px] text-natural-text/30 text-center font-bold">
                    +{transactions.length - 3}
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
