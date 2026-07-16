/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { Check, Copy, Download, Pencil, Plus, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar } from './components/Calendar.tsx';
import { Header } from './components/Header.tsx';
import { MonthlySummary } from './components/MonthlySummary.tsx';
import {
  getMonthTotalSalary,
  groupCheckInsByDate,
  resolveSessionAmount,
} from './transaction-helpers.ts';
import type { ClassCheckIn, FixedClassSchedule, TeachingClass } from './types.ts';
import { formatCurrency, loadStoredValue } from './utils.ts';

const STORAGE_KEY_REGULAR_CHECK_INS = 'class_checkin_records';
const STORAGE_KEY_REGULAR_CLASSES = 'class_checkin_classes';
const STORAGE_KEY_FIXED_CLASSES = 'fixed_class_schedules';
const BULK_IMPORT_EXAMPLE = `Keming
6/7: 9h30 -> 11h
8/7: 10h30 -> 12h
15/7: 9h30 -> 11h

Lyra:
6/7: 3h -> 4h
8/7: 3h -> 4h
13/7: 3h -> 4h
15/7: 1h -> 2h`;

interface ParsedSession {
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionHours: number;
  timeRange: string;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

const normalizeClassKey = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

const normalizeTimeRange = (value: string) => {
  return value.replace(/\s*->\s*/g, ' -> ').replace(/\s+/g, ' ').trim();
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
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, '');
  const match = normalizedValue.match(/^(\d{1,2})(?:h|:)?(\d{1,2})?$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const formatMinutesToTime24h = (totalMinutes: number) => {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${padTimeUnit(hours)}:${padTimeUnit(minutes)}`;
};

const getTimeRangeDurationHours = (timeRange: string) => {
  const [rawStart, rawEnd] = timeRange.split('->').map((part) => part.trim());

  if (!rawStart || !rawEnd) {
    return null;
  }

  const startMinutes = parseTimeLabelToMinutes(rawStart);
  const endMinutes = parseTimeLabelToMinutes(rawEnd);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  let diffMinutes = endMinutes - startMinutes;

  if (diffMinutes <= 0) {
    diffMinutes += 24 * 60;
  }

  return diffMinutes / 60;
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

const normalizeLoadedClasses = (storedClasses: TeachingClass[]) => {
  return storedClasses.map((classItem) => {
    const legacyClass = classItem as TeachingClass & { time?: string };
    const inferredDuration =
      typeof classItem.durationHours === 'number' && Number.isFinite(classItem.durationHours)
        ? classItem.durationHours
        : getTimeRangeDurationHours(legacyClass.time ?? '') ?? 1;

    return {
      id: classItem.id,
      name: classItem.name,
      salary: Number(classItem.salary) || 0,
      note: classItem.note ?? '',
      durationHours: inferredDuration,
    };
  });
};

const normalizeLoadedCheckIns = (storedCheckIns: ClassCheckIn[]) => {
  return storedCheckIns.map((checkIn) => ({
    ...checkIn,
    sessionHours:
      typeof checkIn.sessionHours === 'number' && Number.isFinite(checkIn.sessionHours)
        ? checkIn.sessionHours
        : getTimeRangeDurationHours(checkIn.timeRange ?? '') ?? undefined,
    sessionAmount:
      typeof checkIn.sessionAmount === 'number' && Number.isFinite(checkIn.sessionAmount)
        ? checkIn.sessionAmount
        : undefined,
  }));
};

const parseBulkSchedule = (input: string): { sessions: ParsedSession[]; error: string | null } => {
  const lines = input.split('\n').map((line) => line.trim());
  const sessions: ParsedSession[] = [];
  let currentClassName = '';

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const sessionMatch = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*:?\s*(.+)$/);

    if (sessionMatch) {
      if (!currentClassName) {
        return {
          sessions: [],
          error: `Dong "${line}" chua co ten lop o phia truoc.`,
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
          error: `Khong doc duoc ngay "${dateText}".`,
        };
      }

      if (startMinutes === null || endMinutes === null || sessionHours === null) {
        return {
          sessions: [],
          error: `Khong doc duoc khung gio "${rawTimeText}".`,
        };
      }

      sessions.push({
        className: currentClassName,
        date: parsedDate.toISOString(),
        startTime: formatMinutesToTime24h(startMinutes),
        endTime: formatMinutesToTime24h(endMinutes),
        sessionHours,
        timeRange,
      });
      continue;
    }

    currentClassName = line.replace(/:\s*$/, '').trim();
  }

  if (!sessions.length) {
    return {
      sessions: [],
      error: 'Chua tim thay buoi hoc hop le trong noi dung da nhap.',
    };
  }

  return { sessions, error: null };
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkIns, setCheckIns] = useState<ClassCheckIn[]>(() =>
    normalizeLoadedCheckIns(loadStoredValue<ClassCheckIn[]>(STORAGE_KEY_REGULAR_CHECK_INS, [])),
  );
  const [classes, setClasses] = useState<TeachingClass[]>(() =>
    normalizeLoadedClasses(loadStoredValue<TeachingClass[]>(STORAGE_KEY_REGULAR_CLASSES, [])),
  );
  const [fixedClasses, setFixedClasses] = useState<FixedClassSchedule[]>(() =>
    loadStoredValue<FixedClassSchedule[]>(STORAGE_KEY_FIXED_CLASSES, []),
  );
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
  const [isFixedClassModalOpen, setIsFixedClassModalOpen] = useState(false);
  const [fixedClassName, setFixedClassName] = useState('');
  const [fixedClassSalary, setFixedClassSalary] = useState('');
  const [fixedClassNote, setFixedClassNote] = useState('');
  const [fixedClassDurationHours, setFixedClassDurationHours] = useState('');
  const [fixedClassStartTime, setFixedClassStartTime] = useState('20:00');
  const [fixedClassWeekdays, setFixedClassWeekdays] = useState<number[]>([]);
  const [fixedClassError, setFixedClassError] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CHECK_INS, JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CLASSES, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FIXED_CLASSES, JSON.stringify(fixedClasses));
  }, [fixedClasses]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

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

  const selectedClass = classes.find((classItem) => classItem.id === selectedClassId) ?? null;
  const selectedTimePreview = selectedClass
    ? buildTimeRangeFromStart(checkInStartTime, selectedClass.durationHours)
    : null;

  const openCheckInModal = (day: Date) => {
    setSelectedDay(day);
    setSelectedClassId('');
    setCheckInStartTime(`${padTimeUnit(new Date().getHours())}:${padTimeUnit(new Date().getMinutes())}`);
    setIsCheckInModalOpen(true);
  };

  const resetClassForm = () => {
    setIsAddingClass(false);
    setClassName('');
    setClassSalary('');
    setClassNote('');
    setClassDurationHours('');
  };

  const resetFixedClassForm = () => {
    setFixedClassName('');
    setFixedClassSalary('');
    setFixedClassNote('');
    setFixedClassDurationHours('');
    setFixedClassStartTime('20:00');
    setFixedClassWeekdays([]);
    setFixedClassError('');
  };

  const closeCheckInModal = () => {
    setIsCheckInModalOpen(false);
    setIsClassPickerOpen(false);
    setSelectedClassId('');
    resetClassForm();
  };

  const closeBulkImportModal = () => {
    setIsBulkImportOpen(false);
    setBulkImportError('');
  };

  const closeManageClassesModal = () => {
    setIsManageClassesOpen(false);
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

  const closeFixedClassModal = () => {
    setIsFixedClassModalOpen(false);
    resetFixedClassForm();
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

  const handleSaveFixedClass = () => {
    const trimmedClassName = fixedClassName.trim();
    const salary = Number(fixedClassSalary);
    const durationHours = Number(fixedClassDurationHours);

    if (!trimmedClassName) {
      setFixedClassError('Ban can nhap ten lop.');
      return;
    }

    if (!Number.isFinite(salary) || salary <= 0) {
      setFixedClassError('Luong moi gio phai lon hon 0.');
      return;
    }

    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      setFixedClassError('So gio hoc phai lon hon 0.');
      return;
    }

    if (!fixedClassStartTime) {
      setFixedClassError('Ban can chon gio bat dau.');
      return;
    }

    if (!fixedClassWeekdays.length) {
      setFixedClassError('Ban can chon it nhat 1 thu co dinh.');
      return;
    }

    const newFixedClass: FixedClassSchedule = {
      id: crypto.randomUUID(),
      name: trimmedClassName,
      salary,
      note: fixedClassNote.trim(),
      durationHours,
      startTime: fixedClassStartTime,
      weekdays: [...fixedClassWeekdays].sort((a, b) => a - b),
    };

    setFixedClasses((currentFixedClasses) => [...currentFixedClasses, newFixedClass]);
    closeFixedClassModal();
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

    for (const session of sessions) {
      const classKey = normalizeClassKey(session.className);

      if (!classIdByKey.has(classKey)) {
        const newClass: TeachingClass = {
          id: crypto.randomUUID(),
          name: session.className,
          salary: 0,
          note: '',
          durationHours: session.sessionHours,
        };

        nextClasses.push(newClass);
        classIdByKey.set(classKey, newClass.id);
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

  const handleExportData = () => {
    setIsExportOpen(true);
    setExportCopied(false);
  };

  const exportContent = useMemo(() => {
    const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const grandTotalHours = sortedClasses.reduce((total, classItem) => {
      const classCheckIns = checkIns.filter((checkIn) => checkIn.classId === classItem.id);

      return (
        total +
        classCheckIns.reduce((classTotal, checkIn) => {
          return classTotal + (checkIn.sessionHours ?? classItem.durationHours ?? 0);
        }, 0)
      );
    }, 0);

    const grandTotalAmount = sortedClasses.reduce((total, classItem) => {
      const classCheckIns = checkIns.filter((checkIn) => checkIn.classId === classItem.id);

      return (
        total +
        classCheckIns.reduce((classTotal, checkIn) => {
          return classTotal + resolveSessionAmount(checkIn, classItem);
        }, 0)
      );
    }, 0);

    const classSections = sortedClasses
      .map((classItem) => {
        const classCheckIns = checkIns
          .filter((checkIn) => checkIn.classId === classItem.id)
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

        const totalHours = classCheckIns.reduce((total, checkIn) => {
          return total + (checkIn.sessionHours ?? classItem.durationHours ?? 0);
        }, 0);

        const totalAmount = classCheckIns.reduce((total, checkIn) => {
          return total + resolveSessionAmount(checkIn, classItem);
        }, 0);

        const sessionLines = classCheckIns.map((checkIn) => {
          return `${format(parseISO(checkIn.date), 'd/M')}: ${checkIn.timeRange ?? 'Chua co gio hoc'}`;
        });

        return [
          `${classItem.name}:`,
          ...sessionLines,
          `Tong gio: ${totalHours}h`,
          `Tong tien: ${formatCurrency(totalAmount)}`,
        ].join('\n');
      })
      .join('\n\n');

    const fixedClassSections = fixedClasses
      .map((fixedClass) => {
        const weekdayLabels = fixedClass.weekdays
          .map((weekday) => WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? '')
          .filter(Boolean)
          .join(', ');
        const previewTimeRange = buildTimeRangeFromStart(fixedClass.startTime, fixedClass.durationHours);

        return [
          `${fixedClass.name} (co dinh):`,
          `Lich: ${weekdayLabels}`,
          `Gio hoc: ${previewTimeRange?.timeRange ?? fixedClass.startTime}`,
          `Luong: ${formatCurrency(fixedClass.salary)}/gio`,
        ].join('\n');
      })
      .join('\n\n');

    return [
      classSections,
      fixedClassSections,
      'Tong cong:',
      `Tong gio: ${grandTotalHours}h`,
      `Tong tien: ${formatCurrency(grandTotalAmount)}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [checkIns, classes, fixedClasses]);

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setExportCopied(true);
    } catch {
      setExportCopied(false);
    }
  };

  const openEditClassForm = (classItem: TeachingClass) => {
    setEditingClassId(classItem.id);
    setEditingClassName(classItem.name);
    setEditingClassSalary(String(classItem.salary));
    setEditingClassDurationHours(String(classItem.durationHours));
    setEditingClassNote(classItem.note);
  };

  const handleUpdateClass = () => {
    if (!editingClassId || !editingClassName || !editingClassSalary || !editingClassDurationHours) {
      return;
    }

    const nextSalary = Number(editingClassSalary);
    const nextDurationHours = Number(editingClassDurationHours);

    setClasses((currentClasses) =>
      currentClasses.map((classItem) =>
        classItem.id === editingClassId
          ? {
              ...classItem,
              name: editingClassName,
              salary: nextSalary,
              durationHours: nextDurationHours,
              note: editingClassNote.trim(),
            }
          : classItem,
      ),
    );

    setCheckIns((currentCheckIns) =>
      currentCheckIns.map((checkIn) => {
        if (checkIn.classId !== editingClassId) {
          return checkIn;
        }

        const inferredStartTime =
          checkIn.startTime ??
          (() => {
            const rawStart = checkIn.timeRange?.split('->')[0]?.trim();
            const startMinutes = rawStart ? parseTimeLabelToMinutes(rawStart) : null;

            return startMinutes === null ? undefined : formatMinutesToTime24h(startMinutes);
          })();

        const nextTimeRange = inferredStartTime
          ? buildTimeRangeFromStart(inferredStartTime, nextDurationHours)
          : null;

        return {
          ...checkIn,
          startTime: nextTimeRange?.startTime ?? checkIn.startTime,
          endTime: nextTimeRange?.endTime ?? checkIn.endTime,
          sessionHours: nextDurationHours,
          sessionAmount: nextSalary * nextDurationHours,
          timeRange: nextTimeRange?.timeRange ?? checkIn.timeRange,
        };
      }),
    );

    if (selectedClassId === editingClassId) {
      setSelectedClassId(editingClassId);
    }

    closeManageClassesModal();
  };

  const toggleFixedWeekday = (weekday: number) => {
    setFixedClassWeekdays((currentWeekdays) => {
      return currentWeekdays.includes(weekday)
        ? currentWeekdays.filter((value) => value !== weekday)
        : [...currentWeekdays, weekday];
    });
    setFixedClassError('');
  };

  const isFixedClassFormValid =
    fixedClassName.trim().length > 0 &&
    Number(fixedClassSalary) > 0 &&
    Number(fixedClassDurationHours) > 0 &&
    fixedClassStartTime.length > 0 &&
    fixedClassWeekdays.length > 0;

  return (
    <div className="min-h-screen bg-natural-bg pb-20 font-sans text-natural-text selection:bg-natural-accent/20">
      <Header
        currentDate={currentDate}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        title="Class Check-in"
        subtitle="Theo doi lich day"
      />
      <main className="mx-auto max-w-4xl p-2.5 sm:p-3 md:p-6">
        <div className="mb-3 flex flex-col gap-2.5 md:flex-row md:justify-end">
          <button
            onClick={handleExportData}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-natural-border bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-heading shadow-sm transition-colors hover:border-natural-accent hover:bg-natural-surface sm:px-4 sm:text-[11px] sm:tracking-[0.2em]"
          >
            <Download className="h-4 w-4" /> Xuat du lieu
          </button>
          <button
            onClick={() => setIsManageClassesOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-natural-border bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-heading shadow-sm transition-colors hover:border-natural-accent hover:bg-natural-surface sm:px-4 sm:text-[11px] sm:tracking-[0.2em]"
          >
            <Pencil className="h-4 w-4" /> Danh sach lop
          </button>
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-natural-border bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-heading shadow-sm transition-colors hover:border-natural-accent hover:bg-natural-surface sm:px-4 sm:text-[11px] sm:tracking-[0.2em]"
          >
            <Upload className="h-4 w-4" /> Nhap nhanh lich day
          </button>
        </div>

        <div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-natural-text/40 md:justify-start md:text-[9px] md:tracking-[0.15em]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-natural-accent"></div> Buoi da check-in
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-natural-heading"></div> Tong luong ngay
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#f5e9b8] border border-[#dcc67f]"></div> Lop co dinh
          </div>
        </div>

        <MonthlySummary
          monthTotalSalary={monthTotalSalary}
          monthCheckInCount={monthCheckInCount}
        />

        <Calendar
          calendarDays={calendarDays}
          dayCheckIns={dayCheckIns}
          monthStart={monthStart}
          classes={classes}
          fixedClasses={fixedClasses}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setIsDayListOpen(true);
          }}
        />
      </main>

      <motion.button
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => openCheckInModal(new Date())}
        className="group fixed bottom-6 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-natural-heading text-white shadow-2xl shadow-natural-heading/30 sm:bottom-10 sm:right-10 sm:h-16 sm:w-16"
        id="add-checkin-fab"
      >
        <Plus className="h-7 w-7 sm:h-8 sm:w-8" />
      </motion.button>

      <AnimatePresence>
        {isDayListOpen && selectedDay && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDayListOpen(false)}
              className="absolute inset-0 bg-natural-heading/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border border-natural-border"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-serif italic text-natural-heading">
                    Lich day trong ngay
                  </h3>
                  <p className="text-natural-text/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                    {format(selectedDay, 'dd MMMM yyyy', { locale: vi })}
                  </p>
                </div>
                <button
                  onClick={() => setIsDayListOpen(false)}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto no-scrollbar">
                {selectedDayCheckIns.length ? (
                  selectedDayCheckIns.map((checkIn) => {
                    const classItem = classMap.get(checkIn.classId);
                    const sessionAmount = resolveSessionAmount(checkIn, classItem);

                    return (
                      <div
                        key={checkIn.id}
                        className="p-4 bg-natural-surface rounded-2xl border border-natural-border-light"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-bold text-sm text-natural-heading">
                              {classItem?.name ?? 'Lop khong ton tai'}
                            </p>
                            <p className="text-[10px] text-natural-text/40 uppercase tracking-widest font-bold mt-1">
                              {checkIn.timeRange || 'Chua co gio hoc'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-natural-accent">
                              {formatCurrency(sessionAmount)}
                            </p>
                            <button
                              onClick={() => handleDeleteCheckIn(checkIn.id)}
                              className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-natural-warning transition-colors hover:text-natural-heading"
                            >
                              Xoa
                            </button>
                          </div>
                        </div>
                        {classItem?.note ? (
                          <p className="mt-3 text-sm text-natural-text/70">
                            {classItem.note}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-natural-text/30 font-serif italic text-lg">
                      Chua co check-in
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => openCheckInModal(selectedDay)}
                className="w-full py-4 bg-natural-heading text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-natural-heading/20 active:scale-95 transition-transform"
              >
                <Plus className="w-5 h-5" /> Check-in buoi hoc
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFixedClassModalOpen ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeFixedClassModal}
              className="absolute inset-0 bg-natural-heading/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-[2.5rem] border border-natural-border bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-serif italic text-natural-heading">
                    Tao lop co dinh
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-natural-text/40">
                    Lop co dinh se to mau cac ngay khop thu trong lich
                  </p>
                </div>
                <button
                  onClick={closeFixedClassModal}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                    Ten lop
                  </label>
                  <input
                    type="text"
                    value={fixedClassName}
                    onChange={(event) => {
                      setFixedClassName(event.target.value);
                      setFixedClassError('');
                    }}
                    className="w-full rounded-2xl border border-natural-border bg-white px-5 py-4 font-bold text-base outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                      Luong moi gio
                    </label>
                    <input
                      type="number"
                      value={fixedClassSalary}
                      onChange={(event) => {
                        setFixedClassSalary(event.target.value);
                        setFixedClassError('');
                      }}
                      className="w-full rounded-2xl border border-natural-border bg-white px-5 py-4 font-bold text-base outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                      So gio hoc
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={fixedClassDurationHours}
                      onChange={(event) => {
                        setFixedClassDurationHours(event.target.value);
                        setFixedClassError('');
                      }}
                      className="w-full rounded-2xl border border-natural-border bg-white px-5 py-4 font-bold text-base outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                      Bat dau luc
                    </label>
                    <input
                      type="time"
                      value={fixedClassStartTime}
                      onChange={(event) => {
                        setFixedClassStartTime(event.target.value);
                        setFixedClassError('');
                      }}
                      className="w-full rounded-2xl border border-natural-border bg-white px-5 py-4 font-bold text-base outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                    Thu co dinh
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((option) => {
                      const isActive = fixedClassWeekdays.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleFixedWeekday(option.value)}
                          className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                            isActive
                              ? 'bg-natural-accent text-white'
                              : 'border border-natural-border bg-white text-natural-heading'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                    Ghi chu
                  </label>
                  <textarea
                    value={fixedClassNote}
                    onChange={(event) => {
                      setFixedClassNote(event.target.value);
                      setFixedClassError('');
                    }}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-natural-border bg-white px-5 py-4 text-base outline-none"
                  />
                </div>
              </div>

              {fixedClassError ? (
                <p className="mt-4 text-sm font-medium text-natural-warning">{fixedClassError}</p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveFixedClass}
                  className={`flex-1 rounded-2xl py-4 font-bold text-white shadow-lg shadow-natural-heading/20 transition-opacity ${
                    isFixedClassFormValid
                      ? 'bg-natural-heading'
                      : 'cursor-not-allowed bg-natural-heading/45'
                  }`}
                  disabled={!isFixedClassFormValid}
                >
                  Luu lop co dinh
                </button>
                <button
                  onClick={closeFixedClassModal}
                  className="rounded-2xl border border-natural-border px-5 py-4 font-bold text-natural-heading"
                >
                  Dong
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isExportOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeExportModal}
              className="absolute inset-0 bg-natural-heading/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-3xl rounded-[2.5rem] border border-natural-border bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-serif italic text-natural-heading">
                    Xuat du lieu
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-natural-text/40">
                    Dung format nhu nhap nhanh, co them tong gio va tong tien
                  </p>
                </div>
                <button
                  onClick={closeExportModal}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <textarea
                value={exportContent}
                readOnly
                rows={16}
                className="w-full resize-none rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-5 font-mono text-sm leading-7 text-natural-heading outline-none"
              />

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleCopyExport}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[2rem] bg-natural-heading py-4 font-bold text-white shadow-lg shadow-natural-heading/20 transition-transform active:scale-[0.98]"
                >
                  <Copy className="h-4 w-4" /> {exportCopied ? 'Da copy' : 'Copy noi dung'}
                </button>
                <button
                  onClick={closeExportModal}
                  className="rounded-[2rem] border border-natural-border px-5 py-4 font-bold text-natural-heading transition-colors hover:bg-natural-surface"
                >
                  Dong
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isManageClassesOpen ? (
          <div className="fixed inset-0 z-[75] flex items-start justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeManageClassesModal}
              className="absolute inset-0 bg-natural-heading/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative mt-2 h-[calc(100vh-1rem)] w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-natural-border bg-white p-3 shadow-2xl sm:mt-6 sm:h-auto sm:max-h-[94vh] sm:overflow-y-auto sm:rounded-[2.5rem] sm:p-8"
            >
              <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6 sm:items-center sm:gap-4">
                <div>
                  <h3 className="text-base font-serif italic text-natural-heading sm:text-xl">
                    Danh sach lop day
                  </h3>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-natural-text/40 sm:text-[10px] sm:tracking-widest">
                    Xem va chinh sua thong tin tung lop
                  </p>
                </div>
                <button
                  onClick={closeManageClassesModal}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid h-[calc(100%-3.5rem)] gap-3 overflow-hidden lg:grid-cols-[0.95fr_1.05fr] lg:gap-5">
                <div className="space-y-2 overflow-y-auto no-scrollbar pr-1">
                  {classes.length ? (
                    classes.map((classItem) => {
                      const isEditing = editingClassId === classItem.id;

                      return (
                        <button
                          key={classItem.id}
                          onClick={() => openEditClassForm(classItem)}
                          className={`
                            w-full rounded-[1.5rem] border p-3 text-left transition-all sm:rounded-[2rem] sm:p-5
                            ${isEditing
                              ? 'border-natural-accent bg-natural-accent/8 shadow-lg shadow-natural-accent/10'
                              : 'border-natural-border bg-natural-surface hover:border-natural-heading'
                            }
                          `}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div>
                              <p className="text-sm font-bold text-natural-heading sm:text-base">
                                {classItem.name}
                              </p>
                              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-natural-text/40 sm:text-[10px] sm:tracking-[0.2em]">
                                {classItem.durationHours} gio moi buoi
                              </p>
                              {classItem.note ? (
                                <p className="mt-2 line-clamp-2 text-xs text-natural-text/70 sm:mt-3 sm:text-sm">
                                  {classItem.note}
                                </p>
                              ) : null}
                            </div>
                            <p className="text-left text-base font-bold text-natural-accent sm:text-right sm:text-base">
                              {formatCurrency(classItem.salary)}/gio
                            </p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-10 text-center text-natural-text/35 font-serif italic">
                      Chua co lop nao de chinh sua.
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto rounded-[1.5rem] border border-natural-border bg-natural-surface p-3 sm:rounded-[2rem] sm:p-6">
                  {editingClassId ? (
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-natural-text/50 sm:mb-3 sm:text-[10px] sm:tracking-[0.25em]">
                          Ten lop
                        </label>
                        <input
                          type="text"
                          value={editingClassName}
                          onChange={(event) => setEditingClassName(event.target.value)}
                          className="w-full rounded-[1.25rem] border border-natural-border bg-white px-4 py-3 font-bold text-sm outline-none sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-natural-text/50 sm:mb-3 sm:text-[10px] sm:tracking-[0.25em]">
                            Luong moi gio
                          </label>
                          <input
                            type="number"
                            value={editingClassSalary}
                            onChange={(event) => setEditingClassSalary(event.target.value)}
                            className="w-full rounded-[1.25rem] border border-natural-border bg-white px-4 py-3 font-bold text-sm outline-none sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                          />
                        </div>
                        <div>
                          <label className="block px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-natural-text/50 sm:mb-3 sm:text-[10px] sm:tracking-[0.25em]">
                            So gio hoc
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={editingClassDurationHours}
                            onChange={(event) => setEditingClassDurationHours(event.target.value)}
                            className="w-full rounded-[1.25rem] border border-natural-border bg-white px-4 py-3 font-bold text-sm outline-none sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-natural-text/50 sm:mb-3 sm:text-[10px] sm:tracking-[0.25em]">
                          Ghi chu
                        </label>
                        <textarea
                          value={editingClassNote}
                          onChange={(event) => setEditingClassNote(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-[1.25rem] border border-natural-border bg-white px-4 py-3 text-sm outline-none sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3 sm:pt-2">
                        <button
                          onClick={handleUpdateClass}
                          className="flex-1 rounded-[1.25rem] bg-natural-heading py-3 text-sm font-bold text-white shadow-lg shadow-natural-heading/20 transition-transform active:scale-[0.98] sm:rounded-2xl sm:py-4 sm:text-base"
                        >
                          Luu thay doi
                        </button>
                        <button
                          onClick={closeManageClassesModal}
                          className="rounded-[1.25rem] border border-natural-border px-4 py-3 text-sm font-bold text-natural-text/60 transition-colors hover:bg-white sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                        >
                          Dong
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center text-center text-sm text-natural-text/35 font-serif italic sm:min-h-[280px]">
                      Chon mot lop o ben trai de chinh sua.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkImportOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeBulkImportModal}
              className="absolute inset-0 bg-natural-heading/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-3xl rounded-[2.5rem] border border-natural-border bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-serif italic text-natural-heading">
                    Nhap danh sach buoi da day
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-natural-text/40">
                    Moi lop mot dong ten, cac dong duoi la ngay va gio hoc
                  </p>
                </div>
                <button
                  onClick={closeBulkImportModal}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <textarea
                value={bulkImportValue}
                onChange={(event) => setBulkImportValue(event.target.value)}
                spellCheck={false}
                rows={14}
                className="w-full resize-none rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-5 font-mono text-sm leading-7 text-natural-heading outline-none transition-colors focus:border-natural-accent"
              />

              {bulkImportError ? (
                <p className="mt-4 rounded-2xl bg-natural-warning/8 px-4 py-3 text-sm font-bold text-natural-warning">
                  {bulkImportError}
                </p>
              ) : (
                <p className="mt-4 text-sm text-natural-text/55">
                  Neu lop chua ton tai, app se tu tao lop moi voi luong mac dinh la 0 moi gio.
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleBulkImport}
                  className="flex-1 rounded-[2rem] bg-natural-heading py-4 font-bold text-white shadow-lg shadow-natural-heading/20 transition-transform active:scale-[0.98]"
                >
                  Them len lich
                </button>
                <button
                  onClick={() => setBulkImportValue(BULK_IMPORT_EXAMPLE)}
                  className="rounded-[2rem] border border-natural-border px-5 py-4 font-bold text-natural-heading transition-colors hover:bg-natural-surface"
                >
                  Nap lai vi du
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isCheckInModalOpen && selectedDay ? (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCheckInModal}
              className="absolute inset-0 bg-natural-heading/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[4rem] p-10 md:p-14 shadow-2xl overflow-y-auto max-h-[95vh] border-t border-natural-border"
              id="checkin-modal"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-serif italic text-natural-heading">
                    Check-in lop hoc
                  </h2>
                  <p className="text-natural-text/40 font-bold text-xs uppercase tracking-widest mt-2">
                    {format(selectedDay, 'eeee, dd MMMM', { locale: vi })}
                  </p>
                </div>
                <button
                  onClick={closeCheckInModal}
                  className="p-3 text-natural-warning hover:bg-natural-warning/5 rounded-full transition-all font-bold"
                >
                  Dong
                </button>
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-4 px-1">
                  Bat dau luc
                </label>
                <input
                  type="time"
                  value={checkInStartTime}
                  onChange={(event) => setCheckInStartTime(event.target.value)}
                  className="w-full rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-5 font-bold text-natural-heading outline-none transition-colors focus:border-natural-accent"
                />
              </div>

              <div className="mb-8">
                <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-4 px-1">
                  Lop da chon
                </label>
                <button
                  onClick={() => setIsClassPickerOpen(true)}
                  className="w-full text-left rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-5 hover:border-natural-heading transition-colors"
                >
                  {selectedClass ? (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-natural-heading">
                          {selectedClass.name}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-natural-text/40">
                          {selectedClass.durationHours} gio • {formatCurrency(selectedClass.salary)}/gio
                        </p>
                        {selectedClass.note ? (
                          <p className="mt-3 text-sm text-natural-text/70">
                            {selectedClass.note}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-accent">
                        Doi lop
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-natural-heading">
                          Chon lop de check-in
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-natural-text/35">
                          Bam de mo danh sach lop
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-natural-heading" />
                    </div>
                  )}
                </button>
              </div>

              {selectedClass ? (
                <div className="mb-8 rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-natural-text/40">
                    Buoi hoc se tao
                  </p>
                  <p className="mt-2 text-lg font-bold text-natural-heading">
                    {selectedTimePreview?.timeRange ?? 'Khong doc duoc gio'}
                  </p>
                  <p className="mt-2 text-sm text-natural-text/70">
                    {selectedClass.durationHours} gio x {formatCurrency(selectedClass.salary)}/gio ={' '}
                    <span className="font-bold text-natural-accent">
                      {formatCurrency(selectedClass.durationHours * selectedClass.salary)}
                    </span>
                  </p>
                </div>
              ) : null}

              <button
                onClick={handleConfirmCheckIn}
                disabled={!selectedClassId || !selectedTimePreview}
                className={`
                  w-full py-7 rounded-[2rem] font-bold text-xl tracking-tight transition-all duration-500
                  ${!selectedClassId || !selectedTimePreview
                    ? 'bg-natural-surface text-natural-text/10 cursor-not-allowed'
                    : 'bg-natural-accent text-white hover:bg-natural-heading active:scale-[0.98] shadow-2xl shadow-natural-accent/30'
                  }
                `}
              >
                Xac nhan check-in
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isClassPickerOpen && isCheckInModalOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsClassPickerOpen(false);
                resetClassForm();
              }}
              className="absolute inset-0 bg-natural-heading/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border border-natural-border"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-serif italic text-natural-heading">
                    Chon lop hoc
                  </h3>
                  <p className="text-natural-text/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                    Chon lop co san hoac them lop moi
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsClassPickerOpen(false);
                    resetClassForm();
                  }}
                  className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-[320px] overflow-y-auto no-scrollbar">
                {classes.map((classItem) => {
                  const isActive = classItem.id === selectedClassId;

                  return (
                    <button
                      key={classItem.id}
                      onClick={() => setSelectedClassId(classItem.id)}
                      className={`
                        w-full text-left p-5 rounded-[2rem] border transition-all
                        ${isActive
                          ? 'border-natural-accent bg-natural-accent/8 shadow-lg shadow-natural-accent/10'
                          : 'border-natural-border bg-natural-surface hover:border-natural-heading'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-natural-heading text-base">
                            {classItem.name}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-natural-text/40">
                            {classItem.durationHours} gio moi buoi
                          </p>
                          {classItem.note ? (
                            <p className="mt-3 text-sm text-natural-text/70">
                              {classItem.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-natural-accent">
                            {formatCurrency(classItem.salary)}/gio
                          </p>
                          {isActive ? (
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-natural-accent">
                              Dang chon
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!classes.length ? (
                  <div className="py-8 text-center text-natural-text/35 font-serif italic">
                    Chua co lop nao. Hay them lop dau tien.
                  </div>
                ) : null}
              </div>

              {!isAddingClass ? (
                <button
                  onClick={() => setIsAddingClass(true)}
                  className="w-full py-4 border-2 border-dashed border-natural-border rounded-[2rem] text-natural-heading font-bold hover:bg-natural-surface transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Them lop moi
                </button>
              ) : (
                <div className="rounded-[2rem] border border-natural-border bg-natural-surface p-6 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                      Ten lop
                    </label>
                    <input
                      type="text"
                      value={className}
                      onChange={(event) => setClassName(event.target.value)}
                      placeholder="Vi du: Ban An, lop speaking..."
                      className="w-full bg-white rounded-2xl px-5 py-4 outline-none font-bold text-base shadow-sm border border-natural-border placeholder:text-natural-text/20"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                        Luong moi gio
                      </label>
                      <input
                        type="number"
                        value={classSalary}
                        onChange={(event) => setClassSalary(event.target.value)}
                        placeholder="0"
                        className="w-full bg-white rounded-2xl px-5 py-4 outline-none font-bold text-base shadow-sm border border-natural-border placeholder:text-natural-text/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                        So gio hoc
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={classDurationHours}
                        onChange={(event) => setClassDurationHours(event.target.value)}
                        placeholder="Vi du: 1.5"
                        className="w-full bg-white rounded-2xl px-5 py-4 outline-none font-bold text-base shadow-sm border border-natural-border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-3 px-1">
                      Ghi chu
                    </label>
                    <textarea
                      value={classNote}
                      onChange={(event) => setClassNote(event.target.value)}
                      placeholder="Them ghi chu cho lop hoc..."
                      rows={3}
                      className="w-full bg-white rounded-2xl px-5 py-4 outline-none font-bold text-base shadow-sm border border-natural-border placeholder:text-natural-text/20 resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveClass}
                      className="flex-1 py-4 bg-natural-accent text-white rounded-2xl shadow-lg shadow-natural-accent/20 flex items-center justify-center gap-2 active:scale-95 transition-transform font-bold"
                    >
                      <Check className="w-5 h-5" /> Luu lop
                    </button>
                    <button
                      onClick={resetClassForm}
                      className="px-5 py-4 bg-white text-natural-text/40 border border-natural-border rounded-2xl font-bold active:scale-95 transition-transform"
                    >
                      Huy
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => setIsClassPickerOpen(false)}
                  disabled={!selectedClassId}
                  className={`
                    w-full py-4 rounded-[2rem] font-bold transition-all
                    ${selectedClassId
                      ? 'bg-natural-heading text-white'
                      : 'bg-natural-surface text-natural-text/20 cursor-not-allowed'
                    }
                  `}
                >
                  Xong
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
