import { formatCurrency } from '../utils.ts';
import { Download } from 'lucide-react';

interface MonthlySummaryProps {
  monthTotalSalary: number;
  monthCheckInCount: number;
  monthPaidSalary: number;
  onOpenExportModal?: () => void;
}

export function MonthlySummary({
  monthTotalSalary,
  monthCheckInCount,
  monthPaidSalary,
  onOpenExportModal,
}: MonthlySummaryProps) {
  const remainingSalary = monthTotalSalary - monthPaidSalary;

  return (
    <section className="hallmark-panel mb-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="hallmark-eyebrow">Tổng tháng</p>
            <p className="type-display mt-2 sm:text-4xl">
              {formatCurrency(monthTotalSalary)}
            </p>
          </div>
          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="hallmark-button-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất báo cáo</span>
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="min-w-[180px] rounded-[1.5rem] border border-natural-border bg-white/80 px-4 py-4">
            <p className="hallmark-eyebrow">Số buổi</p>
            <p className="mt-2 text-2xl font-semibold leading-none text-natural-heading">{monthCheckInCount}</p>
            <p className="type-caption mt-1">buổi đã check-in</p>
          </div>
          <div className="min-w-[180px] rounded-[1.5rem] border border-natural-border bg-white/80 px-4 py-4">
            <p className="hallmark-eyebrow">Đã trả</p>
            <p className="mt-2 text-xl font-semibold leading-none text-natural-heading">
              {formatCurrency(monthPaidSalary)}
            </p>
            <p className="type-caption mt-1">đã nhập thanh toán</p>
          </div>
          <div className="min-w-[180px] rounded-[1.5rem] border border-natural-border bg-natural-heading px-4 py-4 text-white">
            <p className="hallmark-eyebrow text-white/65">Còn lại</p>
            <p className="mt-2 text-xl font-semibold leading-none">{formatCurrency(remainingSalary)}</p>
            <p className="type-caption mt-1 text-white/70">cần thanh toán thêm</p>
          </div>
        </div>
      </div>
    </section>
  );
}
