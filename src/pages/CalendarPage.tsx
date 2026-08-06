import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  Plus,
  SlidersHorizontal,
  X,
  PieChart,
  Wallet,
  Menu,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar } from '../components/Calendar';
import { Header } from '../components/Header';
import { MonthlyIncomeBreakdown } from '../components/MonthlyIncomeBreakdown';
import { MonthlySummary } from '../components/MonthlySummary';
import { useAttendance } from '../context/AttendanceContext';
import {
  getMonthTotalSalary,
  groupCheckInsByDate,
  resolveSessionAmount,
} from '../transaction-helpers';
import type { ClassCheckIn, TeachingClass } from '../types';
import { formatCurrency } from '../utils';

const BULK_IMPORT_EXAMPLE = `Keming
160000
6/7: 9h30 -> 11h
8/7: 10h30 -> 12h
15/7: 9h30 -> 11h

Lyra:
120000
6/7: 3h -> 4h
8/7: 3h -> 4h
13/7: 3h -> 4h
15/7: 1h -> 2h`;

interface ParsedSession {
  className: string;
  classSalary: number | null;
  date: string;
  startTime: string;
  endTime: string;
  sessionHours: number;
  timeRange: string;
}

const normalizeClassKey = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

const normalizeTimeRange = (value: string) => {
  return value.replace(/\s*->\s*/g, ' -> ').replace(/\s+/g, ' ').trim();
};

const parseSalaryLine = (value: string) => {
  const normalizedValue = value.replace(/[.\s,₫đ]/gi, '').trim();
  if (!normalizedValue || !/^\d+$/.test(normalizedValue)) {
    return null;
  }
  const salary = Number(normalizedValue);
  return Number.isFinite(salary) ? salary : null;
};

const padTimeUnit = (value: number) => String(value).padStart(2, '0');

const formatTimeLabel = (time24h: string) => {
  const [hoursText, minutesText] = time24h.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? '0');

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return time24h;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h${padTimeUnit(minutes)}`;
};

const parseTimeLabelToMinutes = (value: string) => {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('gio', 'h')
    .replace('g', 'h');

  const hourOnlyMatch = normalizedValue.match(/^(\d{1,2})h$/);
  if (hourOnlyMatch) {
    const hours = Number(hourOnlyMatch[1]);
    return hours >= 0 && hours < 24 ? hours * 60 : null;
  }

  const hourMinuteMatch = normalizedValue.match(/^(\d{1,2})h(\d{1,2})$/);
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1]);
    const minutes = Number(hourMinuteMatch[2]);
    return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
      ? hours * 60 + minutes
      : null;
  }

  const colonMatch = normalizedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
      ? hours * 60 + minutes
      : null;
  }

  return null;
};

const formatMinutesToTime24h = (totalMinutes: number) => {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${padTimeUnit(hours)}:${padTimeUnit(minutes)}`;
};

const getTimeRangeDurationHours = (timeRangeText: string) => {
  const normalizedText = normalizeTimeRange(timeRangeText);
  const [rawStart, rawEnd] = normalizedText.split('->').map((part) => part.trim());

  if (!rawStart || !rawEnd) {
    return null;
  }

  const startMinutes = parseTimeLabelToMinutes(rawStart);
  const endMinutes = parseTimeLabelToMinutes(rawEnd);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  let durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0) {
    durationMinutes += 1440;
  }

  return Number((durationMinutes / 60).toFixed(2));
};

const buildTimeRangeFromStart = (startTime: string, durationHours: number) => {
  const startMinutes = parseTimeLabelToMinutes(startTime);

  if (startMinutes === null) {
    return null;
  }

  const durationMinutes = Math.max(0, Math.round(durationHours * 60));
  const endTime = formatMinutesToTime24h(startMinutes + durationMinutes);

  return {
    startTime,
    endTime,
    timeRange: `${formatTimeLabel(startTime)} -> ${formatTimeLabel(endTime)}`,
  };
};

const parseSessionDate = (rawValue: string) => {
  const match = rawValue.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const parsedYear = yearText ? Number(yearText) : new Date().getFullYear();
  const year = yearText && yearText.length === 2 ? 2000 + parsedYear : parsedYear;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseBulkSchedule = (input: string): { sessions: ParsedSession[]; error: string | null } => {
  const lines = input.split('\n').map((line) => line.trim());
  const sessions: ParsedSession[] = [];
  let currentClassName = '';
  let currentClassSalary: number | null = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const sessionMatch = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*:?\s*(.+)$/);

    if (sessionMatch) {
      if (!currentClassName) {
        return {
          sessions: [],
          error: `Dòng "${line}" chưa có tên lớp ở phía trước.`,
        };
      }

      const [, dateText, rawTimeText] = sessionMatch;
      const parsedDate = parseSessionDate(dateText);
      const timeRange = normalizeTimeRange(rawTimeText);
      const [rawStart, rawEnd] = timeRange.split('->').map((part) => part.trim());
      const startMinutes = rawStart ? parseTimeLabelToMinutes(rawStart) : null;
      const endMinutes = rawEnd ? parseTimeLabelToMinutes(rawEnd) : null;
      const sessionHours = getTimeRangeDurationHours(timeRange);

      if (!parsedDate) {
        return {
          sessions: [],
          error: `Không đọc được ngày "${dateText}".`,
        };
      }

      if (startMinutes === null || endMinutes === null || sessionHours === null) {
        return {
          sessions: [],
          error: `Không đọc được khung giờ "${rawTimeText}".`,
        };
      }

      sessions.push({
        className: currentClassName,
        classSalary: currentClassSalary,
        date: parsedDate.toISOString(),
        startTime: formatMinutesToTime24h(startMinutes),
        endTime: formatMinutesToTime24h(endMinutes),
        sessionHours,
        timeRange,
      });
      continue;
    }

    const parsedSalary = parseSalaryLine(line);

    if (currentClassName && currentClassSalary === null && parsedSalary !== null) {
      currentClassSalary = parsedSalary;
      continue;
    }

    currentClassName = line.replace(/:\s*$/, '').trim();
    currentClassSalary = null;
  }

  if (!sessions.length) {
    return {
      sessions: [],
      error: 'Chưa tìm thấy buổi học hợp lệ trong nội dung đã nhập.',
    };
  }

  return { sessions, error: null };
};

export function CalendarPage() {
  const {
    currentDate,
    nextMonth,
    prevMonth,
    checkIns,
    setCheckIns,
    classes,
    setClasses,
    salaryPayments,
    addSalaryPayment,
  } = useAttendance();

  // Modals & Popups State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [className, setClassName] = useState('');
  const [classSalary, setClassSalary] = useState('');
  const [classNote, setClassNote] = useState('');
  const [classDurationHours, setClassDurationHours] = useState('');
  const [checkInStartTime, setCheckInStartTime] = useState(() => {
    return `${padTimeUnit(new Date().getHours())}:${padTimeUnit(new Date().getMinutes())}`;
  });
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportValue, setBulkImportValue] = useState(BULK_IMPORT_EXAMPLE);
  const [bulkImportError, setBulkImportError] = useState('');
  const [isManageClassesOpen, setIsManageClassesOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState('');
  const [editingClassName, setEditingClassName] = useState('');
  const [editingClassSalary, setEditingClassSalary] = useState('');
  const [editingClassDurationHours, setEditingClassDurationHours] = useState('');
  const [editingClassNote, setEditingClassNote] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [isSalaryPaymentModalOpen, setIsSalaryPaymentModalOpen] = useState(false);
  const [salaryPaymentDate, setSalaryPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [salaryPaymentAmount, setSalaryPaymentAmount] = useState('');
  const [salaryPaymentNote, setSalaryPaymentNote] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const dayCheckIns = useMemo(() => groupCheckInsByDate(checkIns), [checkIns]);

  const monthTotalSalary = useMemo(
    () => getMonthTotalSalary(checkIns, classes, currentDate),
    [checkIns, classes, currentDate],
  );

  const monthCheckInCount = useMemo(() => {
    return checkIns.filter((checkIn) => {
      return format(parseISO(checkIn.date), 'yyyy-MM') === format(currentDate, 'yyyy-MM');
    }).length;
  }, [checkIns, currentDate]);

  const monthPaidSalary = useMemo(() => {
    return salaryPayments
      .filter((payment) => format(parseISO(payment.date), 'yyyy-MM') === format(currentDate, 'yyyy-MM'))
      .reduce((total, payment) => total + payment.amount, 0);
  }, [salaryPayments, currentDate]);

  const monthlyIncomeItems = useMemo(() => {
    const groupedMonths = new Map<
      string,
      { totalAmount: number; paidAmount: number; checkInCount: number }
    >();
    const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

    checkIns.forEach((checkIn) => {
      const checkInDate = parseISO(checkIn.date);
      const monthKey = format(checkInDate, 'yyyy-MM');
      const currentMonth = groupedMonths.get(monthKey) ?? {
        totalAmount: 0,
        paidAmount: 0,
        checkInCount: 0,
      };
      const classItem = classMap.get(checkIn.classId);

      groupedMonths.set(monthKey, {
        totalAmount: currentMonth.totalAmount + resolveSessionAmount(checkIn, classItem),
        paidAmount: currentMonth.paidAmount,
        checkInCount: currentMonth.checkInCount + 1,
      });
    });

    salaryPayments.forEach((payment) => {
      const monthKey = format(parseISO(payment.date), 'yyyy-MM');
      const currentMonth = groupedMonths.get(monthKey) ?? {
        totalAmount: 0,
        paidAmount: 0,
        checkInCount: 0,
      };

      groupedMonths.set(monthKey, {
        totalAmount: currentMonth.totalAmount,
        paidAmount: currentMonth.paidAmount + payment.amount,
        checkInCount: currentMonth.checkInCount,
      });
    });

    return Array.from(groupedMonths.entries())
      .sort(([firstMonth], [secondMonth]) => secondMonth.localeCompare(firstMonth))
      .map(([monthKey, summary]) => ({
        monthKey,
        monthLabel: format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: vi }),
        totalAmount: summary.totalAmount,
        paidAmount: summary.paidAmount,
        remainingAmount: summary.totalAmount - summary.paidAmount,
        checkInCount: summary.checkInCount,
      }));
  }, [checkIns, classes, salaryPayments]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((firstClass, secondClass) =>
      firstClass.name.localeCompare(secondClass.name, 'vi'),
    );
  }, [classes]);

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId) ?? null;
  const selectedTimePreview = selectedClass
    ? buildTimeRangeFromStart(checkInStartTime, selectedClass.durationHours)
    : null;

  const openCheckInModal = (day: Date) => {
    setIsDayListOpen(false);
    setSelectedDay(day);
    setSelectedClassId('');
    setCheckInStartTime(`${padTimeUnit(new Date().getHours())}:${padTimeUnit(new Date().getMinutes())}`);
    setIsAddingClass(classes.length === 0);
    setIsCheckInModalOpen(true);
  };

  const resetClassForm = () => {
    setIsAddingClass(false);
    setClassName('');
    setClassSalary('');
    setClassNote('');
    setClassDurationHours('');
  };

  const closeCheckInModal = () => {
    setIsCheckInModalOpen(false);
    setSelectedClassId('');
    resetClassForm();
  };

  const closeBulkImportModal = () => {
    setIsBulkImportOpen(false);
    setBulkImportError('');
  };

  const closeManageClassesModal = () => {
    setIsManageClassesOpen(false);
    setIsEditClassModalOpen(false);
    setEditingClassId('');
    setEditingClassName('');
    setEditingClassSalary('');
    setEditingClassDurationHours('');
    setEditingClassNote('');
  };

  const closeExportModal = () => {
    setIsExportOpen(false);
    setExportCopied(false);
  };

  const closeSalaryPaymentModal = () => {
    setIsSalaryPaymentModalOpen(false);
    setSalaryPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setSalaryPaymentAmount('');
    setSalaryPaymentNote('');
  };

  const handleSaveClass = () => {
    if (!className || !classSalary || !classDurationHours) {
      return;
    }

    const newClass: TeachingClass = {
      id: crypto.randomUUID(),
      name: className,
      salary: Number(classSalary),
      note: classNote.trim(),
      durationHours: Number(classDurationHours),
    };

    setClasses((currentClasses) => [...currentClasses, newClass]);
    setSelectedClassId(newClass.id);
    resetClassForm();
  };

  const handleConfirmCheckIn = () => {
    if (!selectedDay || !selectedClassId || !selectedClass || !selectedTimePreview) {
      return;
    }

    const newCheckIn: ClassCheckIn = {
      id: crypto.randomUUID(),
      classId: selectedClassId,
      date: selectedDay.toISOString(),
      startTime: selectedTimePreview.startTime,
      endTime: selectedTimePreview.endTime,
      sessionHours: selectedClass.durationHours,
      sessionAmount: selectedClass.salary * selectedClass.durationHours,
      timeRange: selectedTimePreview.timeRange,
    };

    setCheckIns((currentCheckIns) => [...currentCheckIns, newCheckIn]);
    closeCheckInModal();
    setIsDayListOpen(false);
  };

  const selectedDateKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
  const selectedDayCheckIns = selectedDateKey ? dayCheckIns[selectedDateKey] ?? [] : [];
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  const handleBulkImport = () => {
    const { sessions, error } = parseBulkSchedule(bulkImportValue);

    if (error) {
      setBulkImportError(error);
      return;
    }

    const nextClasses = [...classes];
    const classIdByKey = new Map(
      nextClasses.map((classItem) => [normalizeClassKey(classItem.name), classItem.id]),
    );
    const classSalaryByKey = new Map<string, number>();

    for (const session of sessions) {
      const classKey = normalizeClassKey(session.className);
      const importedSalary = session.classSalary;

      if (importedSalary !== null && !classSalaryByKey.has(classKey)) {
        classSalaryByKey.set(classKey, importedSalary);
      }

      if (!classIdByKey.has(classKey)) {
        const newClass: TeachingClass = {
          id: crypto.randomUUID(),
          name: session.className,
          salary: importedSalary ?? 0,
          note: '',
          durationHours: session.sessionHours,
        };

        nextClasses.push(newClass);
        classIdByKey.set(classKey, newClass.id);
      }
    }

    for (const classItem of nextClasses) {
      const classKey = normalizeClassKey(classItem.name);
      const importedSalary = classSalaryByKey.get(classKey);

      if (importedSalary !== undefined) {
        classItem.salary = importedSalary;
      }
    }

    const existingCheckInKeys = new Set(
      checkIns.map((checkIn) => {
        return [
          checkIn.classId,
          format(parseISO(checkIn.date), 'yyyy-MM-dd'),
          normalizeTimeRange(checkIn.timeRange ?? ''),
          checkIn.startTime ?? '',
        ].join('|');
      }),
    );

    const newCheckIns: ClassCheckIn[] = [];

    for (const session of sessions) {
      const classId = classIdByKey.get(normalizeClassKey(session.className));

      if (!classId) {
        continue;
      }

      const checkInKey = [
        classId,
        format(parseISO(session.date), 'yyyy-MM-dd'),
        normalizeTimeRange(session.timeRange),
        session.startTime,
      ].join('|');

      if (existingCheckInKeys.has(checkInKey)) {
        continue;
      }

      existingCheckInKeys.add(checkInKey);
      newCheckIns.push({
        id: crypto.randomUUID(),
        classId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        sessionHours: session.sessionHours,
        timeRange: session.timeRange,
      });
    }

    setClasses(nextClasses);
    setCheckIns((currentCheckIns) => [...currentCheckIns, ...newCheckIns]);
    setBulkImportError('');
    setIsBulkImportOpen(false);
  };

  const handleDeleteCheckIn = (checkInId: string) => {
    setCheckIns((currentCheckIns) => {
      return currentCheckIns.filter((checkIn) => checkIn.id !== checkInId);
    });
  };

  const handleRequestDeleteCheckIn = (checkInId: string) => {
    const shouldDelete = window.confirm('Bạn có chắc muốn xóa buổi check-in này không?');
    if (!shouldDelete) return;
    handleDeleteCheckIn(checkInId);
  };

  const handleOpenEditClassModal = (targetClass: TeachingClass) => {
    setEditingClassId(targetClass.id);
    setEditingClassName(targetClass.name);
    setEditingClassSalary(String(targetClass.salary));
    setEditingClassDurationHours(String(targetClass.durationHours));
    setEditingClassNote(targetClass.note ?? '');
    setIsEditClassModalOpen(true);
  };

  const handleSaveEditClass = () => {
    if (!editingClassId || !editingClassName || !editingClassSalary || !editingClassDurationHours) {
      return;
    }

    setClasses((currentClasses) =>
      currentClasses.map((classItem) =>
        classItem.id === editingClassId
          ? {
              ...classItem,
              name: editingClassName.trim(),
              salary: Number(editingClassSalary),
              durationHours: Number(editingClassDurationHours),
              note: editingClassNote.trim(),
            }
          : classItem,
      ),
    );

    setIsEditClassModalOpen(false);
  };

  const handleDeleteClass = (targetClassId: string) => {
    const targetClass = classes.find((c) => c.id === targetClassId);
    const hasCheckIns = checkIns.some((checkIn) => checkIn.classId === targetClassId);

    if (
      !window.confirm(
        hasCheckIns
          ? `Lớp "${targetClass?.name}" đang có dữ liệu check-in. Bạn có chắc muốn xóa không?`
          : `Bạn có chắc muốn xóa lớp "${targetClass?.name}" không?`,
      )
    ) {
      return;
    }

    setClasses((currentClasses) => currentClasses.filter((c) => c.id !== targetClassId));
    setCheckIns((currentCheckIns) => currentCheckIns.filter((checkIn) => checkIn.classId !== targetClassId));
  };

  const handleSaveSalaryPayment = () => {
    if (!salaryPaymentAmount || Number(salaryPaymentAmount) <= 0) {
      return;
    }

    addSalaryPayment({
      date: new Date(salaryPaymentDate).toISOString(),
      amount: Number(salaryPaymentAmount),
      note: salaryPaymentNote.trim(),
    });

    closeSalaryPaymentModal();
  };

  const exportSummaryData = useMemo(() => {
    const monthKey = format(currentDate, 'yyyy-MM');
    const currentMonthCheckIns = checkIns.filter(
      (c) => format(parseISO(c.date), 'yyyy-MM') === monthKey,
    );

    const classStatsMap = new Map<
      string,
      { count: number; totalHours: number; totalAmount: number; name: string; salary: number }
    >();

    currentMonthCheckIns.forEach((checkIn) => {
      const classItem = classMap.get(checkIn.classId);
      const name = classItem?.name ?? 'Lớp đã xóa';
      const salary = classItem?.salary ?? 0;
      const hours = checkIn.sessionHours ?? classItem?.durationHours ?? 0;
      const amount = resolveSessionAmount(checkIn, classItem);

      const existing = classStatsMap.get(checkIn.classId) ?? {
        count: 0,
        totalHours: 0,
        totalAmount: 0,
        name,
        salary,
      };

      classStatsMap.set(checkIn.classId, {
        count: existing.count + 1,
        totalHours: existing.totalHours + hours,
        totalAmount: existing.totalAmount + amount,
        name,
        salary,
      });
    });

    return {
      monthLabel: format(currentDate, 'MMMM yyyy', { locale: vi }),
      totalSalary: monthTotalSalary,
      paidSalary: monthPaidSalary,
      remainingSalary: monthTotalSalary - monthPaidSalary,
      checkInCount: monthCheckInCount,
      classes: Array.from(classStatsMap.values()),
    };
  }, [checkIns, classMap, currentDate, monthPaidSalary, monthTotalSalary, monthCheckInCount]);

  const exportAsText = () => {
    const lines = [
      `=== BÁO CÁO THU NHẬP - ${exportSummaryData.monthLabel.toUpperCase()} ===`,
      `Tổng thu nhập dự kiến: ${formatCurrency(exportSummaryData.totalSalary)}`,
      `Đã nhận: ${formatCurrency(exportSummaryData.paidSalary)}`,
      `Còn lại: ${formatCurrency(exportSummaryData.remainingSalary)}`,
      `Tổng số buổi dạy: ${exportSummaryData.checkInCount} buổi`,
      '',
      '--- CHI TIẾT THEO LỚP ---',
    ];

    exportSummaryData.classes.forEach((c) => {
      lines.push(
        `- ${c.name}: ${c.count} buổi (${c.totalHours}h) -> ${formatCurrency(c.totalAmount)}`,
      );
    });

    return lines.join('\n');
  };

  const copyExportText = async () => {
    try {
      await navigator.clipboard.writeText(exportAsText());
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg pb-28">
      <Header
        currentDate={currentDate}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        title="Lịch dạy học"
        subtitle="Chấm công & theo dõi lịch dạy"
        showMonthPicker={true}
      />

      <main className="mx-auto max-w-4xl px-3 py-4 space-y-4 sm:px-6 sm:py-6">
        {/* iPhone Compact Month Summary Bar (Pill Card) */}
        <div
          onClick={() => setIsSummaryModalOpen(true)}
          className="cursor-pointer bg-gradient-to-r from-natural-heading to-[#1c3c50] text-white p-3.5 rounded-2xl shadow-md border border-white/10 flex items-center justify-between transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-natural-accent">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-white/65">
                Tổng thu nhập {format(currentDate, 'MM/yyyy')}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold font-serif">
                  {formatCurrency(monthTotalSalary)}
                </span>
                <span className="text-xs text-white/70">({monthCheckInCount} buổi)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-natural-accent bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
            <span>Chi tiết</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Calendar Main Board (iPhone Primary Focused View) */}
        <Calendar
          calendarDays={calendarDays}
          monthStart={monthStart}
          selectedDay={selectedDay}
          dayCheckIns={dayCheckIns}
          classes={classes}
          onSelectDay={(day) => {
            setSelectedDay(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            if (dayCheckIns[dateKey]?.length) {
              setIsDayListOpen(true);
            } else {
              openCheckInModal(day);
            }
          }}
        />
      </main>

      {/* Floating Bottom iPhone Action Bar (Dock) */}
      <div className="fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto">
        <div className="bg-natural-heading/95 backdrop-blur-xl text-white p-2.5 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.3)] border border-white/20 flex items-center justify-between gap-2">
          {/* Action 1: Check-in Today */}
          <button
            onClick={() => openCheckInModal(new Date())}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-natural-accent text-natural-heading rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Chấm công</span>
          </button>

          {/* Action 2: Summary Popup */}
          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="flex items-center justify-center p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95"
            title="Xem báo cáo tháng"
          >
            <PieChart className="w-5 h-5" />
          </button>

          {/* Action 3: Menu Tools Popup */}
          <button
            onClick={() => setIsQuickMenuOpen(true)}
            className="flex items-center justify-center p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95"
            title="Menu tiện ích"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ------------------- POPUPS & MODALS ------------------- */}

      {/* Monthly Summary & Breakdown Popup Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-natural-overlay-strong backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="hallmark-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 bg-white rounded-t-[2.5rem] sm:rounded-[2rem] space-y-5"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3 sticky top-0 bg-white z-10 pt-1">
                <div>
                  <h3 className="type-title flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-natural-accent" />
                    Báo cáo Tháng {format(currentDate, 'MM/yyyy')}
                  </h3>
                  <p className="type-caption">Tổng hợp doanh thu & chi tiết theo tháng</p>
                </div>
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="p-2 rounded-full hover:bg-natural-surface text-natural-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Monthly Summary Cards */}
              <MonthlySummary
                monthTotalSalary={monthTotalSalary}
                monthPaidSalary={monthPaidSalary}
                monthCheckInCount={monthCheckInCount}
                onOpenExportModal={() => {
                  setIsSummaryModalOpen(false);
                  setIsExportOpen(true);
                }}
              />

              {/* Monthly Income Breakdown List */}
              <MonthlyIncomeBreakdown items={monthlyIncomeItems} />

              <div className="pt-2">
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="hallmark-button-primary w-full"
                >
                  Đóng tóm tắt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Menu Tools Popup / Bottom Sheet */}
      <AnimatePresence>
        {isQuickMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-natural-overlay-strong backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="hallmark-panel w-full max-w-md p-5 bg-white rounded-t-[2.5rem] sm:rounded-[2rem] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Menu & Tiện ích</h3>
                  <p className="type-caption">Các tính năng hỗ trợ quản lý</p>
                </div>
                <button
                  onClick={() => setIsQuickMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-natural-surface text-natural-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setIsManageClassesOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-natural-border bg-natural-panel hover:bg-natural-surface flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-natural-heading border border-natural-border">
                      <SlidersHorizontal className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-natural-heading">Quản lý lớp học</p>
                      <p className="text-xs text-natural-muted">Hiện có {classes.length} lớp</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-natural-muted" />
                </button>

                <button
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setIsSalaryPaymentModalOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-natural-border bg-natural-panel hover:bg-natural-surface flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-natural-heading">Ghi nhận nhận lương</p>
                      <p className="text-xs text-natural-muted">Nhập khoản lương đã thu</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-natural-muted" />
                </button>

                <button
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-natural-border bg-natural-panel hover:bg-natural-surface flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-natural-heading border border-natural-border">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-natural-heading">Nhập hàng loạt</p>
                      <p className="text-xs text-natural-muted">Dán lịch học dạng text</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-natural-muted" />
                </button>

                <button
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    setIsExportOpen(true);
                  }}
                  className="p-3.5 rounded-2xl border border-natural-border bg-natural-panel hover:bg-natural-surface flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl text-natural-heading border border-natural-border">
                      <Copy className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-natural-heading">Xuất báo cáo</p>
                      <p className="text-xs text-natural-muted">Sao chép văn bản tóm tắt</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-natural-muted" />
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsQuickMenuOpen(false)}
                  className="hallmark-button-secondary w-full"
                >
                  Đóng Menu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Check-In Modal */}
      <AnimatePresence>
        {isCheckInModalOpen && selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-lg p-6 bg-white space-y-5"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Chấm công ngày {format(selectedDay, 'dd/MM/yyyy')}</h3>
                  <p className="type-caption">Chọn lớp học và thời gian bắt đầu</p>
                </div>
                <button
                  onClick={closeCheckInModal}
                  className="p-2 rounded-full hover:bg-natural-surface text-natural-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Class Select or Add */}
              <div className="space-y-3">
                <label className="type-caption font-bold uppercase">Lớp học</label>
                {classes.length > 0 && (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="hallmark-input text-sm"
                  >
                    <option value="">-- Chọn lớp học --</option>
                    {sortedClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.salary)}/h - {c.durationHours}h)
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setIsAddingClass(!isAddingClass)}
                  className="text-xs font-semibold text-natural-accent hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingClass ? 'Hủy tạo lớp mới' : 'Tạo lớp học mới'}
                </button>

                {isAddingClass && (
                  <div className="p-4 bg-natural-panel rounded-2xl border border-natural-border space-y-3">
                    <input
                      type="text"
                      placeholder="Tên lớp (VD: Keming, Lyra)"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="hallmark-input text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Lương/giờ (VD: 150000)"
                        value={classSalary}
                        onChange={(e) => setClassSalary(e.target.value)}
                        className="hallmark-input text-sm"
                      />
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Số giờ (VD: 1.5)"
                        value={classDurationHours}
                        onChange={(e) => setClassDurationHours(e.target.value)}
                        className="hallmark-input text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSaveClass}
                      className="hallmark-button-primary w-full text-xs"
                    >
                      Lưu lớp học
                    </button>
                  </div>
                )}
              </div>

              {/* Start Time Select */}
              {selectedClass && (
                <div className="space-y-3">
                  <label className="type-caption font-bold uppercase">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={checkInStartTime}
                    onChange={(e) => setCheckInStartTime(e.target.value)}
                    className="hallmark-input text-sm"
                  />

                  {selectedTimePreview && (
                    <div className="p-3 bg-natural-panel-strong rounded-xl text-xs font-semibold text-natural-heading flex items-center justify-between">
                      <span>Thời gian: {selectedTimePreview.timeRange}</span>
                      <span>Dự kiến: {formatCurrency(selectedClass.salary * selectedClass.durationHours)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button onClick={closeCheckInModal} className="hallmark-button-secondary">
                  Hủy
                </button>
                <button
                  onClick={handleConfirmCheckIn}
                  disabled={!selectedClassId || !selectedTimePreview}
                  className="hallmark-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Xác nhận chấm công
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Day Check-Ins List Modal */}
      <AnimatePresence>
        {isDayListOpen && selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-lg p-6 bg-white space-y-5"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Các buổi dạy ngày {format(selectedDay, 'dd/MM/yyyy')}</h3>
                  <p className="type-caption">Danh sách các lớp đã check-in</p>
                </div>
                <button
                  onClick={() => setIsDayListOpen(false)}
                  className="p-2 rounded-full hover:bg-natural-surface text-natural-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {selectedDayCheckIns.map((checkIn) => {
                  const classItem = classMap.get(checkIn.classId);
                  const amount = resolveSessionAmount(checkIn, classItem);

                  return (
                    <div
                      key={checkIn.id}
                      className="p-3 bg-natural-panel rounded-2xl border border-natural-border flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-natural-heading">
                          {classItem?.name ?? 'Lớp đã xóa'}
                        </p>
                        <p className="text-xs text-natural-muted">
                          {checkIn.timeRange} ({checkIn.sessionHours ?? classItem?.durationHours}h)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-natural-heading">
                          {formatCurrency(amount)}
                        </span>
                        <button
                          onClick={() => handleRequestDeleteCheckIn(checkIn.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => openCheckInModal(selectedDay)}
                  className="hallmark-button-secondary"
                >
                  + Thêm buổi dạy
                </button>
                <button
                  onClick={() => setIsDayListOpen(false)}
                  className="hallmark-button-primary"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isBulkImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-xl p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Nhập dữ liệu hàng loạt</h3>
                  <p className="type-caption">Dán danh sách lịch dạy và lương theo định dạng mẫu</p>
                </div>
                <button onClick={closeBulkImportModal} className="p-2 rounded-full hover:bg-natural-surface text-natural-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                rows={10}
                value={bulkImportValue}
                onChange={(e) => setBulkImportValue(e.target.value)}
                className="hallmark-input font-mono text-xs"
              />

              {bulkImportError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {bulkImportError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={closeBulkImportModal} className="hallmark-button-secondary">
                  Hủy
                </button>
                <button onClick={handleBulkImport} className="hallmark-button-primary">
                  Xác nhận nhập
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Classes Modal */}
      <AnimatePresence>
        {isManageClassesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-lg p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Quản lý các lớp học</h3>
                  <p className="type-caption">Danh sách {classes.length} lớp học hiện tại</p>
                </div>
                <button onClick={closeManageClassesModal} className="p-2 rounded-full hover:bg-natural-surface text-natural-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {classes.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 bg-natural-panel rounded-2xl border border-natural-border flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm text-natural-heading">{c.name}</p>
                      <p className="text-xs text-natural-muted">
                        {formatCurrency(c.salary)}/h • {c.durationHours}h/buổi
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditClassModal(c)}
                        className="px-3 py-1.5 rounded-xl border border-natural-border text-xs font-semibold hover:bg-white"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteClass(c.id)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={closeManageClassesModal} className="hallmark-button-primary">
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Class Modal */}
      <AnimatePresence>
        {isEditClassModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-md p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Chỉnh sửa thông tin lớp</h3>
                  <p className="type-caption">Cập nhật tên lớp, mức lương và số giờ</p>
                </div>
                <button
                  onClick={() => setIsEditClassModalOpen(false)}
                  className="p-2 rounded-full hover:bg-natural-surface text-natural-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="type-caption uppercase font-bold">Tên lớp</label>
                  <input
                    type="text"
                    value={editingClassName}
                    onChange={(e) => setEditingClassName(e.target.value)}
                    className="hallmark-input text-sm mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="type-caption uppercase font-bold">Mức lương (VNĐ/h)</label>
                    <input
                      type="number"
                      value={editingClassSalary}
                      onChange={(e) => setEditingClassSalary(e.target.value)}
                      className="hallmark-input text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="type-caption uppercase font-bold">Số giờ/buổi</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editingClassDurationHours}
                      onChange={(e) => setEditingClassDurationHours(e.target.value)}
                      className="hallmark-input text-sm mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="type-caption uppercase font-bold">Ghi chú</label>
                  <input
                    type="text"
                    value={editingClassNote}
                    onChange={(e) => setEditingClassNote(e.target.value)}
                    className="hallmark-input text-sm mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsEditClassModalOpen(false)}
                  className="hallmark-button-secondary"
                >
                  Hủy
                </button>
                <button onClick={handleSaveEditClass} className="hallmark-button-primary">
                  Cập nhật
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary Payment Modal */}
      <AnimatePresence>
        {isSalaryPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-md p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Ghi nhận thanh toán lương</h3>
                  <p className="type-caption">Nhập số tiền đã nhận từ trung tâm/học sinh</p>
                </div>
                <button onClick={closeSalaryPaymentModal} className="p-2 rounded-full hover:bg-natural-surface text-natural-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="type-caption uppercase font-bold">Ngày nhận</label>
                  <input
                    type="date"
                    value={salaryPaymentDate}
                    onChange={(e) => setSalaryPaymentDate(e.target.value)}
                    className="hallmark-input text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="type-caption uppercase font-bold">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="VD: 5000000"
                    value={salaryPaymentAmount}
                    onChange={(e) => setSalaryPaymentAmount(e.target.value)}
                    className="hallmark-input text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="type-caption uppercase font-bold">Ghi chú</label>
                  <input
                    type="text"
                    placeholder="VD: Nhận lương tháng 7"
                    value={salaryPaymentNote}
                    onChange={(e) => setSalaryPaymentNote(e.target.value)}
                    className="hallmark-input text-sm mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeSalaryPaymentModal} className="hallmark-button-secondary">
                  Hủy
                </button>
                <button onClick={handleSaveSalaryPayment} className="hallmark-button-primary">
                  Lưu thanh toán
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-overlay-strong backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="hallmark-panel w-full max-w-lg p-6 bg-white space-y-4"
            >
              <div className="flex items-center justify-between border-b border-natural-border-light pb-3">
                <div>
                  <h3 className="type-title">Báo cáo thu nhập {exportSummaryData.monthLabel}</h3>
                  <p className="type-caption">Sao chép văn bản tóm tắt thu nhập</p>
                </div>
                <button onClick={closeExportModal} className="p-2 rounded-full hover:bg-natural-surface text-natural-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                readOnly
                rows={8}
                value={exportAsText()}
                className="hallmark-input font-mono text-xs bg-natural-panel"
              />

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={copyExportText}
                  className="hallmark-button-secondary flex items-center gap-2"
                >
                  {exportCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {exportCopied ? 'Đã sao chép!' : 'Sao chép văn bản'}
                </button>
                <button onClick={closeExportModal} className="hallmark-button-primary">
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
