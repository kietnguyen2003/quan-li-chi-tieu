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
    <section className="hallmark-panel mb-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="hallmark-eyebrow">Monthly ledger</p>
          <p className="mt-2 font-serif text-3xl text-natural-heading sm:text-4xl">
            {formatCurrency(monthTotalSalary)}
          </p>
        </div>

        <div className="min-w-[180px] rounded-[1.5rem] border border-natural-border bg-white/80 px-4 py-4">
          <p className="hallmark-eyebrow">Sessions</p>
          <p className="mt-2 text-2xl font-semibold text-natural-heading">{monthCheckInCount}</p>
          <p className="mt-1 text-sm text-natural-muted">buoi da check-in</p>
        </div>
      </div>
    </section>
  );
}
