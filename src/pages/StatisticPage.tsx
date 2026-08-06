import { useMemo, useState } from 'react';
import {
  format,
  parseISO,
  isSameMonth,
  isSameYear,
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  TrendingUp,
  DollarSign,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  Award,
  BarChart2,
  PieChart,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAttendance } from '../context/AttendanceContext';
import { Header } from '../components/Header';
import { resolveSessionAmount, resolveSessionHours } from '../transaction-helpers';
import { formatCurrency } from '../utils';

type TimeFilter = 'this_month' | 'last_3_months' | 'this_year' | 'all';

export function StatisticPage() {
  const { checkIns, classes, salaryPayments, currentDate, nextMonth, prevMonth } = useAttendance();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_month');

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // Filter check-ins and payments based on selected time filter
  const { filteredCheckIns, filteredPayments, filterPeriodLabel } = useMemo(() => {
    const now = currentDate;

    if (timeFilter === 'this_month') {
      const filteredC = checkIns.filter((c) => isSameMonth(parseISO(c.date), now));
      const filteredP = salaryPayments.filter((p) => isSameMonth(parseISO(p.date), now));
      return {
        filteredCheckIns: filteredC,
        filteredPayments: filteredP,
        filterPeriodLabel: format(now, 'MMMM yyyy', { locale: vi }),
      };
    }

    if (timeFilter === 'last_3_months') {
      const threeMonthsAgo = subMonths(now, 2);
      const start = startOfMonth(threeMonthsAgo);
      const end = endOfMonth(now);
      const interval = { start, end };

      const filteredC = checkIns.filter((c) => isWithinInterval(parseISO(c.date), interval));
      const filteredP = salaryPayments.filter((p) => isWithinInterval(parseISO(p.date), interval));
      return {
        filteredCheckIns: filteredC,
        filteredPayments: filteredP,
        filterPeriodLabel: `3 tháng gần nhất (${format(threeMonthsAgo, 'MM/yyyy')} - ${format(now, 'MM/yyyy')})`,
      };
    }

    if (timeFilter === 'this_year') {
      const filteredC = checkIns.filter((c) => isSameYear(parseISO(c.date), now));
      const filteredP = salaryPayments.filter((p) => isSameYear(parseISO(p.date), now));
      return {
        filteredCheckIns: filteredC,
        filteredPayments: filteredP,
        filterPeriodLabel: `Năm ${format(now, 'yyyy')}`,
      };
    }

    // 'all'
    return {
      filteredCheckIns: checkIns,
      filteredPayments: salaryPayments,
      filterPeriodLabel: 'Tất cả thời gian',
    };
  }, [checkIns, salaryPayments, currentDate, timeFilter]);

  // Calculated Metrics
  const totalEstimatedSalary = useMemo(() => {
    return filteredCheckIns.reduce((sum, checkIn) => {
      const classItem = classMap.get(checkIn.classId);
      return sum + resolveSessionAmount(checkIn, classItem);
    }, 0);
  }, [filteredCheckIns, classMap]);

  const totalHoursTaught = useMemo(() => {
    return filteredCheckIns.reduce((sum, checkIn) => {
      const classItem = classMap.get(checkIn.classId);
      return sum + resolveSessionHours(checkIn, classItem);
    }, 0);
  }, [filteredCheckIns, classMap]);

  const totalSessions = filteredCheckIns.length;

  const totalReceivedSalary = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [filteredPayments]);

  const remainingBalance = totalEstimatedSalary - totalReceivedSalary;

  const avgPerSession = totalSessions > 0 ? Math.round(totalEstimatedSalary / totalSessions) : 0;
  const avgPerHour = totalHoursTaught > 0 ? Math.round(totalEstimatedSalary / totalHoursTaught) : 0;

  // Breakdown by Class
  const classBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        rate: number;
        totalAmount: number;
        totalHours: number;
        sessionCount: number;
      }
    >();

    filteredCheckIns.forEach((checkIn) => {
      const classItem = classMap.get(checkIn.classId);
      const className = classItem?.name ?? 'Lớp không tên';
      const classId = checkIn.classId;
      const amount = resolveSessionAmount(checkIn, classItem);
      const hours = resolveSessionHours(checkIn, classItem);

      if (!map.has(classId)) {
        map.set(classId, {
          id: classId,
          name: className,
          rate: classItem?.salary ?? 0,
          totalAmount: 0,
          totalHours: 0,
          sessionCount: 0,
        });
      }

      const existing = map.get(classId)!;
      existing.totalAmount += amount;
      existing.totalHours += hours;
      existing.sessionCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredCheckIns, classMap]);

  // Monthly Trend (Past 6 Months)
  const monthlyTrendData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = subMonths(currentDate, i);
      const monthCheckIns = checkIns.filter((c) => isSameMonth(parseISO(c.date), targetMonth));
      const monthPayments = salaryPayments.filter((p) => isSameMonth(parseISO(p.date), targetMonth));

      const earned = monthCheckIns.reduce((sum, c) => {
        const classItem = classMap.get(c.classId);
        return sum + resolveSessionAmount(c, classItem);
      }, 0);

      const hours = monthCheckIns.reduce((sum, c) => {
        const classItem = classMap.get(c.classId);
        return sum + resolveSessionHours(c, classItem);
      }, 0);

      const received = monthPayments.reduce((sum, p) => sum + p.amount, 0);

      result.push({
        label: format(targetMonth, 'MMM/yy', { locale: vi }),
        fullLabel: format(targetMonth, 'MMMM yyyy', { locale: vi }),
        earned,
        received,
        hours,
        sessions: monthCheckIns.length,
      });
    }
    return result;
  }, [checkIns, salaryPayments, currentDate, classMap]);

  const maxEarnedInTrend = useMemo(() => {
    return Math.max(...monthlyTrendData.map((d) => Math.max(d.earned, d.received)), 1);
  }, [monthlyTrendData]);

  return (
    <div className="min-h-screen bg-natural-bg pb-16">
      <Header
        currentDate={currentDate}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        title="Thống kê & Báo cáo"
        subtitle="Phân tích doanh thu, giờ dạy và tình trạng thanh toán"
        showMonthPicker={false}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
        {/* Time Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-natural-border shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto p-1">
            <button
              onClick={() => setTimeFilter('this_month')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                timeFilter === 'this_month'
                  ? 'bg-natural-heading text-white shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading hover:bg-natural-surface'
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setTimeFilter('last_3_months')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                timeFilter === 'last_3_months'
                  ? 'bg-natural-heading text-white shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading hover:bg-natural-surface'
              }`}
            >
              3 tháng gần nhất
            </button>
            <button
              onClick={() => setTimeFilter('this_year')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                timeFilter === 'this_year'
                  ? 'bg-natural-heading text-white shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading hover:bg-natural-surface'
              }`}
            >
              Năm nay
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                timeFilter === 'all'
                  ? 'bg-natural-heading text-white shadow-sm'
                  : 'text-natural-muted hover:text-natural-heading hover:bg-natural-surface'
              }`}
            >
              Tất cả
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-natural-panel-strong rounded-xl text-xs font-medium text-natural-heading border border-natural-border/60">
            <CalendarIcon className="w-4 h-4 text-natural-accent" />
            <span className="capitalize">{filterPeriodLabel}</span>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Estimated Income */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="hallmark-panel p-5 bg-gradient-to-br from-natural-heading to-[#1a384b] text-white shadow-lg relative overflow-hidden group"
          >
            <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70">
                Thu nhập dự kiến
              </span>
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <DollarSign className="w-5 h-5 text-natural-accent" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold font-serif tracking-tight">
                {formatCurrency(totalEstimatedSalary)}
              </div>
              <p className="text-xs text-white/60 mt-1">Tính theo các buổi đã chấm công</p>
            </div>
          </motion.div>

          {/* Card 2: Received Payments */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="hallmark-panel p-5 bg-white border border-natural-border shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="hallmark-eyebrow">Đã nhận lương</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold font-serif text-emerald-700">
                {formatCurrency(totalReceivedSalary)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {totalEstimatedSalary > 0
                    ? `${Math.round((totalReceivedSalary / totalEstimatedSalary) * 100)}% đã thu`
                    : '0% đã thu'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Unpaid Balance */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="hallmark-panel p-5 bg-white border border-natural-border shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="hallmark-eyebrow">Còn nợ / Chưa thu</span>
              <div
                className={`p-2 rounded-xl ${
                  remainingBalance > 0
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl sm:text-3xl font-bold font-serif ${
                  remainingBalance > 0 ? 'text-amber-700' : 'text-slate-600'
                }`}
              >
                {formatCurrency(Math.max(0, remainingBalance))}
              </div>
              <p className="text-xs text-natural-muted mt-1">
                {remainingBalance > 0 ? 'Cần đối soát thanh toán' : 'Đã thanh toán đủ'}
              </p>
            </div>
          </motion.div>

          {/* Card 4: Hours & Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="hallmark-panel p-5 bg-white border border-natural-border shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="hallmark-eyebrow">Tổng giờ & Buổi dạy</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold font-serif text-natural-heading">
                {totalHoursTaught} <span className="text-sm font-sans font-normal text-natural-muted">giờ</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-natural-muted">
                <span className="font-semibold text-natural-heading">{totalSessions}</span> buổi dạy tổng cộng
              </div>
            </div>
          </motion.div>
        </div>

        {/* Secondary Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="hallmark-panel p-4 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-natural-panel-strong rounded-2xl text-natural-heading">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="hallmark-eyebrow">Trung bình / Buổi dạy</p>
                <p className="text-xl font-bold font-serif text-natural-heading mt-0.5">
                  {formatCurrency(avgPerSession)}
                </p>
              </div>
            </div>
            <span className="text-xs text-natural-muted font-medium bg-natural-panel px-3 py-1 rounded-full border border-natural-border">
              {totalSessions} buổi
            </span>
          </div>

          <div className="hallmark-panel p-4 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-natural-panel-strong rounded-2xl text-natural-heading">
                <Award className="w-5 h-5 text-natural-accent" />
              </div>
              <div>
                <p className="hallmark-eyebrow">Trung bình / Giờ dạy</p>
                <p className="text-xl font-bold font-serif text-natural-heading mt-0.5">
                  {formatCurrency(avgPerHour)}
                </p>
              </div>
            </div>
            <span className="text-xs text-natural-muted font-medium bg-natural-panel px-3 py-1 rounded-full border border-natural-border">
              {totalHoursTaught}h tổng
            </span>
          </div>
        </div>

        {/* Visual Charts & Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual Bar Chart (Monthly Trend) */}
          <div className="lg:col-span-2 hallmark-panel p-6 bg-white space-y-6">
            <div className="flex items-center justify-between border-b border-natural-border-light pb-4">
              <div>
                <h3 className="type-title flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-natural-accent" />
                  Xu hướng thu nhập 6 tháng gần nhất
                </h3>
                <p className="type-caption mt-0.5">So sánh thu nhập dự kiến & số tiền thực nhận</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-natural-heading inline-block" />
                  <span className="text-natural-muted">Thu nhập</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                  <span className="text-natural-muted">Thực nhận</span>
                </div>
              </div>
            </div>

            {/* Custom Bar Visualization */}
            <div className="pt-4 pb-2">
              <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 px-2">
                {monthlyTrendData.map((data, index) => {
                  const earnedHeightPercent =
                    maxEarnedInTrend > 0 ? (data.earned / maxEarnedInTrend) * 100 : 0;
                  const receivedHeightPercent =
                    maxEarnedInTrend > 0 ? (data.received / maxEarnedInTrend) * 100 : 0;

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-natural-heading text-white text-[10px] p-2 rounded-xl absolute -mt-16 z-20 pointer-events-none shadow-xl border border-white/20 whitespace-nowrap">
                        <p className="font-bold border-b border-white/20 pb-1 mb-1">{data.fullLabel}</p>
                        <p className="text-natural-accent">Dự kiến: {formatCurrency(data.earned)}</p>
                        <p className="text-emerald-300">Đã nhận: {formatCurrency(data.received)}</p>
                        <p className="text-white/80">{data.hours}h ({data.sessions} buổi)</p>
                      </div>

                      {/* Bars Pair */}
                      <div className="w-full flex items-end justify-center gap-1.5 h-full">
                        {/* Earned Bar */}
                        <div
                          style={{ height: `${Math.max(earnedHeightPercent, 4)}%` }}
                          className="w-1/2 max-w-[28px] bg-natural-heading rounded-t-lg transition-all duration-500 group-hover:bg-natural-text relative"
                        />
                        {/* Received Bar */}
                        <div
                          style={{ height: `${Math.max(receivedHeightPercent, 4)}%` }}
                          className="w-1/2 max-w-[28px] bg-emerald-500 rounded-t-lg transition-all duration-500 group-hover:bg-emerald-600 relative"
                        />
                      </div>

                      <span className="text-[11px] font-semibold text-natural-muted uppercase tracking-wider capitalize">
                        {data.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Revenue Breakdown by Class */}
          <div className="hallmark-panel p-6 bg-white space-y-6">
            <div className="border-b border-natural-border-light pb-4">
              <h3 className="type-title flex items-center gap-2">
                <PieChart className="w-5 h-5 text-natural-accent" />
                Tỷ trọng theo Lớp học
              </h3>
              <p className="type-caption mt-0.5">Phân bổ doanh thu trong khoảng thời gian đã chọn</p>
            </div>

            {classBreakdown.length === 0 ? (
              <div className="py-12 text-center text-natural-muted text-sm">
                Chưa có dữ liệu chấm công trong thời gian này
              </div>
            ) : (
              <div className="space-y-4">
                {classBreakdown.map((item) => {
                  const percentage =
                    totalEstimatedSalary > 0
                      ? Math.round((item.totalAmount / totalEstimatedSalary) * 100)
                      : 0;

                  return (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-natural-heading truncate max-w-[160px]">
                          {item.name}
                        </span>
                        <span className="font-serif font-bold text-natural-heading">
                          {formatCurrency(item.totalAmount)}{' '}
                          <span className="text-[10px] text-natural-muted font-sans">({percentage}%)</span>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-natural-panel-strong rounded-full overflow-hidden">
                        <div
                          className="h-full bg-natural-heading rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-natural-muted">
                        <span>{item.sessionCount} buổi dạy</span>
                        <span>{item.totalHours} giờ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Class Performance Table */}
        <div className="hallmark-panel p-6 bg-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-natural-border-light pb-4">
            <div>
              <h3 className="type-title flex items-center gap-2">
                <Award className="w-5 h-5 text-natural-accent" />
                Bảng Thống kê Chi tiết Lớp học
              </h3>
              <p className="type-caption mt-0.5">Danh sách các lớp học sắp xếp theo doanh thu</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-natural-panel text-natural-heading rounded-full border border-natural-border w-fit">
              {classBreakdown.length} Lớp đang dạy
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-natural-border text-[11px] uppercase tracking-wider font-bold text-natural-muted">
                  <th className="py-3 px-3">Xếp hạng</th>
                  <th className="py-3 px-3">Tên Lớp Học</th>
                  <th className="py-3 px-3">Học Phí / Giờ</th>
                  <th className="py-3 px-3">Số Buổi</th>
                  <th className="py-3 px-3">Tổng Giờ</th>
                  <th className="py-3 px-3 text-right">Tổng Thu Nhập</th>
                  <th className="py-3 px-3 text-right">Tỷ Trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-border-light text-sm">
                {classBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-natural-muted text-sm">
                      Chưa có lớp học nào có dữ liệu chấm công.
                    </td>
                  </tr>
                ) : (
                  classBreakdown.map((c, index) => {
                    const percentage =
                      totalEstimatedSalary > 0
                        ? Math.round((c.totalAmount / totalEstimatedSalary) * 100)
                        : 0;

                    return (
                      <tr key={c.id} className="hover:bg-natural-surface transition-colors">
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : index === 1
                                ? 'bg-slate-200 text-slate-700'
                                : index === 2
                                ? 'bg-amber-700/10 text-amber-900'
                                : 'bg-natural-panel-strong text-natural-muted'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-natural-heading">{c.name}</td>
                        <td className="py-3.5 px-3 text-natural-muted">{formatCurrency(c.rate)}/h</td>
                        <td className="py-3.5 px-3 font-medium text-natural-heading">{c.sessionCount} buổi</td>
                        <td className="py-3.5 px-3 text-natural-muted">{c.totalHours}h</td>
                        <td className="py-3.5 px-3 text-right font-serif font-bold text-natural-heading">
                          {formatCurrency(c.totalAmount)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-semibold text-natural-accent">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Salary Payment Records Table */}
        <div className="hallmark-panel p-6 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-natural-border-light pb-4">
            <div>
              <h3 className="type-title flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Lịch sử Nhận Lương / Thanh toán
              </h3>
              <p className="type-caption mt-0.5">Các khoản thanh toán lương đã ghi nhận</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Tổng đã nhận: {formatCurrency(totalReceivedSalary)}
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-natural-muted text-sm">
              Chưa có lịch sử nhận lương trong thời gian này
            </div>
          ) : (
            <div className="divide-y divide-natural-border-light">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="py-3 flex items-center justify-between hover:bg-natural-surface px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-natural-heading">
                        {payment.note || 'Thanh toán lương'}
                      </p>
                      <p className="text-xs text-natural-muted">
                        {format(parseISO(payment.date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-serif font-bold text-base text-emerald-700">
                      +{formatCurrency(payment.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
