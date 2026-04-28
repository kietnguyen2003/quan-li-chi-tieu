import { useMemo, useState } from 'react';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';

import type { Transaction } from '../lib/types.ts';

interface ClearMonthTransactionsProps {
  currentDate: Date;
  transactions: Transaction[];
  onClearMonthTransactions: () => void;
}

export function ClearMonthTransactions({
  currentDate,
  transactions,
  onClearMonthTransactions,
}: ClearMonthTransactionsProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const monthInterval = useMemo(
    () => ({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    }),
    [currentDate],
  );

  const monthTransactionCount = useMemo(
    () =>
      transactions.filter((transaction) =>
        isWithinInterval(parseISO(transaction.date), monthInterval),
      ).length,
    [monthInterval, transactions],
  );

  const handleConfirmClear = () => {
    onClearMonthTransactions();
    setIsConfirmOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={monthTransactionCount === 0}
        className="h-11 px-5 rounded-xl bg-white border border-natural-border text-natural-warning disabled:text-natural-text/20 disabled:bg-natural-surface disabled:cursor-not-allowed hover:bg-natural-warning/5 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-sm"
      >
        <Trash2 className="w-4 h-4" />
        Xoá tháng này
      </button>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsConfirmOpen(false)}
            className="absolute inset-0 bg-natural-heading/40 backdrop-blur-md"
          />

          <motion.section
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="relative w-full max-w-md bg-white border border-natural-border rounded-3xl p-5 md:p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-serif italic text-natural-heading">Xoá dữ liệu tháng</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/40 mt-1">
                  {format(currentDate, 'MMMM yyyy', { locale: vi })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="w-10 h-10 rounded-xl border border-natural-border text-natural-text/50 hover:text-natural-heading hover:bg-natural-surface transition-colors flex items-center justify-center shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm leading-6 text-natural-text/70">
              Bạn sắp xoá {monthTransactionCount} giao dịch trong tháng hiện tại. Thao tác này không thể hoàn tác.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="h-11 rounded-xl border border-natural-border text-natural-heading hover:bg-natural-surface transition-colors text-sm font-bold"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="h-11 rounded-xl bg-natural-warning text-white hover:bg-natural-heading transition-colors text-sm font-bold"
              >
                Xác nhận xoá
              </button>
            </div>
          </motion.section>
        </div>
      )}
    </>
  );
}
