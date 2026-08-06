import { formatCurrency } from '../utils.ts';

interface MonthlyIncomeItem {
  monthKey: string;
  monthLabel: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  checkInCount: number;
}

interface MonthlyIncomeBreakdownProps {
  items: MonthlyIncomeItem[];
}

export function MonthlyIncomeBreakdown({ items }: MonthlyIncomeBreakdownProps) {
  return (
    <section className="hallmark-panel px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="hallmark-eyebrow">Theo từng tháng</p>
          <h4 className="type-heading mt-2">Thống kê tiền dạy</h4>
        </div>
        <p className="rounded-full border border-natural-border bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/55">
          {items.length} tháng
        </p>
      </div>

      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.monthKey}
              className="rounded-[1.5rem] border border-natural-border bg-white/85 px-4 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="type-title capitalize">{item.monthLabel}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/45">
                    {item.checkInCount} buổi check-in
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-natural-accent sm:text-lg">
                    {formatCurrency(item.totalAmount)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/45">
                    Đã trả {formatCurrency(item.paidAmount)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-natural-border-light bg-natural-surface px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/45">
                    Tổng lương
                  </p>
                  <p className="mt-1 text-sm font-semibold text-natural-heading">
                    {formatCurrency(item.totalAmount)}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-natural-border-light bg-natural-heading px-3 py-2 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
                    Còn lại
                  </p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(item.remainingAmount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.5rem] border border-dashed border-natural-border bg-white/70 px-4 py-8 text-center">
          <p className="type-title text-natural-text/45">Chưa có dữ liệu để thống kê</p>
          <p className="type-body mt-2">Khi có check-in, phần này sẽ tự gom tiền theo từng tháng.</p>
        </div>
      )}
    </section>
  );
}
