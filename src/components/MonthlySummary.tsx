import { formatCurrency } from '../utils.ts';

interface MonthlySummaryProps {
  monthTotalSalary: number;
  monthCheckInCount: number;
}

export function MonthlySummary({
  monthTotalSalary,
  monthCheckInCount,
}: MonthlySummaryProps) {
  return (
    <div className="mb-4 rounded-[2rem] border border-natural-border bg-white px-4 py-3 shadow-lg shadow-natural-heading/5 sm:rounded-3xl sm:px-5 sm:py-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-natural-text/40 sm:text-[10px] sm:tracking-[0.25em]">
        Tong thang
      </p>
      <p className="mt-1 text-xl font-bold text-natural-accent sm:text-2xl">
        {formatCurrency(monthTotalSalary)}
      </p>
      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.16em] text-natural-text/35 sm:text-[10px] sm:tracking-[0.2em]">
        {monthCheckInCount} buoi da check-in
      </p>
    </div>
  );
}
