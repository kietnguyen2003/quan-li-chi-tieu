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
    <div className="mb-4 rounded-3xl border border-natural-border bg-white px-5 py-4 shadow-lg shadow-natural-heading/5">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-natural-text/40">
        Tong thang
      </p>
      <p className="mt-1 text-2xl font-bold text-natural-accent">
        {formatCurrency(monthTotalSalary)}
      </p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-natural-text/35">
        {monthCheckInCount} buoi da check-in
      </p>
    </div>
  );
}
