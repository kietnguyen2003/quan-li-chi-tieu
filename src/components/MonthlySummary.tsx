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
          <p className="hallmark-eyebrow">Tổng tháng</p>
          <p className="type-display mt-2 sm:text-4xl">
            {formatCurrency(monthTotalSalary)}
          </p>
        </div>

        <div className="min-w-[180px] rounded-[1.5rem] border border-natural-border bg-white/80 px-4 py-4">
          <p className="hallmark-eyebrow">Số buổi</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-natural-heading">{monthCheckInCount}</p>
          <p className="type-caption mt-1">buổi đã check-in</p>
        </div>
      </div>
    </section>
  );
}
