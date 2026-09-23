import { useMemo } from 'react';
import { format, isSameMonth, parseISO, subMonths } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useAttendance } from '../context/useAttendance';
import { Header } from '../components/Header';
import { resolveSessionAmount, resolveSessionHours } from '../transaction-helpers';
import { formatCurrency } from '../utils';

const formatHours = (hours: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(hours);
const panel = 'rounded-2xl border border-natural-border bg-natural-surface';
const disclosure = 'flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-natural-heading [&::-webkit-details-marker]:hidden';

export function StatisticPage() {
  const { checkIns, classes, salaryPayments, currentDate, nextMonth, prevMonth } = useAttendance();
  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);

  const summary = useMemo(() => {
    const sessions = checkIns.filter((item) => isSameMonth(parseISO(item.date), currentDate));
    const payments = salaryPayments
      .filter((item) => isSameMonth(parseISO(item.date), currentDate))
      .toSorted((first, second) => second.date.localeCompare(first.date));
    const byClass = new Map<string, { id: string; name: string; hours: number; count: number; amount: number }>();
    for (const session of sessions) {
      const teachingClass = classMap.get(session.classId);
      const previous = byClass.get(session.classId);
      byClass.set(session.classId, {
        id: session.classId,
        name: teachingClass?.name ?? 'Lớp đã lưu trữ',
        hours: (previous?.hours ?? 0) + resolveSessionHours(session, teachingClass),
        count: (previous?.count ?? 0) + 1,
        amount: (previous?.amount ?? 0) + resolveSessionAmount(session, teachingClass),
      });
    }
    const breakdown = [...byClass.values()].sort((first, second) => second.amount - first.amount);
    return {
      breakdown, payments,
      earned: breakdown.reduce((total, item) => total + item.amount, 0),
      hours: breakdown.reduce((total, item) => total + item.hours, 0),
      count: sessions.length,
      received: payments.reduce((total, item) => total + item.amount, 0),
    };
  }, [checkIns, salaryPayments, currentDate, classMap]);

  const trend = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(currentDate, 5 - index);
    return {
      label: format(month, 'MM/yyyy'),
      earned: checkIns.filter((item) => isSameMonth(parseISO(item.date), month))
        .reduce((total, item) => total + resolveSessionAmount(item, classMap.get(item.classId)), 0),
      received: salaryPayments.filter((item) => isSameMonth(parseISO(item.date), month))
        .reduce((total, item) => total + item.amount, 0),
    };
  }), [checkIns, salaryPayments, currentDate, classMap]);
  const maxTrend = Math.max(...trend.map((item) => item.earned), 1);
  const balance = checkIns.reduce((total, item) => total + resolveSessionAmount(item, classMap.get(item.classId)), 0)
    - salaryPayments.reduce((total, item) => total + item.amount, 0);

  return (
    <div className="min-h-screen bg-natural-bg pb-8">
      <Header currentDate={currentDate} onPrevMonth={prevMonth} onNextMonth={nextMonth} title="Thống kê thu nhập" />
      <main className="mx-auto max-w-5xl space-y-3 px-3 py-3 sm:px-6 sm:py-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <section aria-label="Chưa được trả" className="col-span-2 rounded-2xl bg-natural-heading p-4 text-white lg:col-span-1">
            <h2 className="text-xs text-white/70">Chưa được trả · toàn bộ lịch sử</h2>
            <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{formatCurrency(Math.max(0, balance))}</p>
            <p className="mt-2 text-[11px] text-white/70">{balance < 0 ? `Đã nhận trước ${formatCurrency(-balance)}` : 'Tổng tiền đã dạy − tổng tiền đã nhận'}</p>
          </section>
          <section className={`${panel} p-4`} aria-label="Thu nhập tháng">
            <h2 className="text-xs text-natural-muted">Thu nhập tháng {format(currentDate, 'MM')}</h2>
            <p className="mt-2 break-words font-serif text-2xl font-semibold text-natural-heading">{formatCurrency(summary.earned)}</p>
          </section>
          <section className={`${panel} p-4`} aria-label="Đã nhận tháng">
            <h2 className="text-xs text-natural-muted">Đã nhận tháng {format(currentDate, 'MM')}</h2>
            <p className="mt-2 break-words font-serif text-2xl font-semibold text-natural-success">{formatCurrency(summary.received)}</p>
          </section>
          <section className={`${panel} col-span-2 p-4 lg:col-span-1`}>
            <h2 className="text-xs text-natural-muted">Khối lượng giảng dạy trong tháng</h2>
            <p className="mt-2 text-xl font-semibold text-natural-heading">{summary.count} buổi · {formatHours(summary.hours)} giờ</p>
            <p className="mt-1 text-xs text-natural-muted">{summary.breakdown.length} lớp có buổi dạy</p>
          </section>
        </div>

        <section className={panel} aria-labelledby="class-income-title">
          <div className="flex items-center justify-between gap-3 border-b border-natural-border-light px-4 py-3">
            <h2 id="class-income-title" className="text-sm font-semibold text-natural-heading">Thu nhập theo lớp</h2>
            <span className="text-xs text-natural-muted">{summary.breakdown.length} lớp</span>
          </div>
          {summary.breakdown.length ? <ul className="divide-y divide-natural-border-light px-4">
            {summary.breakdown.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-natural-heading">{item.name}</p>
                <p className="mt-0.5 text-xs text-natural-muted">{item.count} buổi <span aria-hidden="true">/</span> {formatHours(item.hours)} giờ</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-natural-heading">{formatCurrency(item.amount)}</p>
            </li>)}
          </ul> : <p className="px-4 py-6 text-center text-sm text-natural-muted">Chưa có buổi dạy trong tháng này.</p>}
        </section>

        <details className={`${panel} group`}>
          <summary className={disclosure}>
            <span>Lịch sử nhận lương</span>
            <span className="flex items-center gap-2 text-xs font-normal text-natural-muted">{summary.payments.length} khoản<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></span>
          </summary>
          {summary.payments.length ? <ul className="divide-y divide-natural-border-light border-t border-natural-border-light px-4">
            {summary.payments.map((payment) => <li key={payment.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm text-natural-heading">{payment.note || 'Nhận lương'}</p>
                <p className="mt-0.5 text-xs text-natural-muted">{format(parseISO(payment.date), 'dd/MM/yyyy')}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-natural-success">+{formatCurrency(payment.amount)}</span>
            </li>)}
          </ul> : <p className="border-t border-natural-border-light px-4 py-4 text-sm text-natural-muted">Chưa có khoản nhận lương trong tháng này.</p>}
        </details>

        <section className={panel}>
          <h2 className="px-4 pt-4 text-sm font-semibold text-natural-heading">Xu hướng thu nhập · 6 tháng</h2>
          <div className="flex h-40 items-end gap-3 px-5 pb-6 pt-5" aria-label="Biểu đồ thu nhập 6 tháng">
            {trend.map((item) => <div key={item.label} className="relative flex h-full flex-1 items-end justify-center gap-1" title={`${item.label}: Thu nhập ${formatCurrency(item.earned)}, đã nhận ${formatCurrency(item.received)}`}>
              <div className="w-5 rounded-t bg-natural-heading" style={{ height: `${item.earned / Math.max(maxTrend, ...trend.map((month) => month.received)) * 100}%` }} />
              <div className="w-5 rounded-t bg-natural-accent" style={{ height: `${item.received / Math.max(maxTrend, ...trend.map((month) => month.received)) * 100}%` }} />
              <span className="absolute -bottom-5 text-[10px] text-natural-muted">{item.label.slice(0, 2)}</span>
            </div>)}
          </div>
          <p className="px-4 py-2 text-xs text-natural-muted">Xanh: thu nhập · Vàng: đã nhận</p>
          <div className="border-t border-natural-border-light px-4 py-2">
            <table className="w-full table-fixed text-xs tabular-nums" aria-label="Thu nhập và thực nhận trong 6 tháng">
              <thead><tr className="text-natural-muted"><th className="w-1/4 py-2 text-left font-normal">Tháng</th><th className="py-2 text-right font-normal">Thu nhập</th><th className="py-2 text-right font-normal">Đã nhận</th></tr></thead>
              <tbody>{trend.map((item) => <tr key={item.label} className="border-t border-natural-border-light text-natural-heading">
                <th scope="row" className="py-3 text-left font-normal">{item.label}</th>
                <td className="py-3 pl-2 text-right"><span className="break-words">{formatCurrency(item.earned)}</span><div aria-hidden="true" className="ml-auto mt-1 h-1 max-w-20 rounded-full bg-natural-border-light"><div className="h-full rounded-full bg-natural-heading" style={{ width: `${item.earned / maxTrend * 100}%` }} /></div></td>
                <td className="break-words py-3 pl-2 text-right text-natural-success">{formatCurrency(item.received)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
