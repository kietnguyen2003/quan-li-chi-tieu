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
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Pencil,
  Plus,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar } from './components/Calendar.tsx';
import { Header } from './components/Header.tsx';
import { MonthlySummary } from './components/MonthlySummary.tsx';
import {
  getMonthTotalSalary,
  groupCheckInsByDate,
  resolveSessionAmount,
} from './transaction-helpers.ts';
import type { ClassCheckIn, TeachingClass } from './types.ts';
import { formatCurrency, loadStoredValue } from './utils.ts';

const STORAGE_KEY_REGULAR_CHECK_INS = 'class_checkin_records';
const STORAGE_KEY_REGULAR_CLASSES = 'class_checkin_classes';
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
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const [isClassListOpen, setIsClassListOpen] = useState(false);
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CHECK_INS, JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CLASSES, JSON.stringify(classes));
  }, [classes]);

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
    setSelectedDay(day);
    setSelectedClassId('');
    setIsClassListOpen(classes.length === 0);
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
    setIsClassListOpen(false);
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

    return [
      classSections,
      'Tong cong:',
      `Tong gio: ${grandTotalHours}h`,
      `Tong tien: ${formatCurrency(grandTotalAmount)}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [checkIns, classes]);

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

  return (
    <div className="hallmark-shell min-h-screen pb-20 font-sans text-natural-text selection:bg-natural-accent/20">
      <Header
        currentDate={currentDate}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        title="Class Check-in"
        subtitle="Theo doi lich day"
      />
      <main className="mx-auto max-w-5xl p-3 sm:p-4 md:p-6">
        <section className="mb-4">
          <div className="mb-3 flex flex-col gap-2 px-1 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="hallmark-eyebrow">Calendar ledger</p>
              <h3 className="mt-2 font-serif text-2xl text-natural-heading">Lich day theo thang</h3>
            </div>
            <div className="hidden flex-col gap-3 md:flex md:items-end">
              <p className="max-w-sm text-sm text-natural-muted md:text-right">
                Chon mot ngay trong lich de xem buoi da day hoac tao check-in moi.
              </p>
              <button
                type="button"
                onClick={() => setIsWorkspacePanelOpen(true)}
                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-natural-border bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-heading shadow-sm hover:border-natural-accent md:self-auto"
              >
                Tien ich va tong quan
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <Calendar
            calendarDays={calendarDays}
            dayCheckIns={dayCheckIns}
            monthStart={monthStart}
            classes={classes}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setIsDayListOpen(true);
            }}
          />
        </section>

      </main>

      <AnimatePresence>
        {isWorkspacePanelOpen ? (
          <div className="fixed inset-0 z-[65] flex items-end justify-end p-0 sm:items-center sm:justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWorkspacePanelOpen(false)}
              className="absolute inset-0 bg-natural-heading/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="relative h-[100dvh] w-full max-w-md overflow-y-auto rounded-none bg-white p-4 shadow-2xl sm:h-auto sm:max-w-4xl sm:rounded-[2.5rem] sm:border sm:border-natural-border sm:p-8"
            >
              <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
                <div>
                  <p className="hallmark-eyebrow">Workspace drawer</p>
                  <h3 className="mt-2 font-serif text-2xl text-natural-heading">
                    Tien ich va tong quan
                  </h3>
                </div>
                <button
                  onClick={() => setIsWorkspacePanelOpen(false)}
                  className="rounded-full p-2 text-natural-text/30 transition-colors hover:text-natural-warning"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-[2rem] border border-natural-border/70 bg-white/65 px-4 py-3 text-[8px] font-bold uppercase tracking-[0.14em] text-natural-text/45 shadow-sm backdrop-blur-sm md:text-[9px] md:tracking-[0.18em]">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-natural-accent"></div> Buoi da check-in
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-natural-heading"></div> Tong luong ngay
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                <MonthlySummary
                  monthTotalSalary={monthTotalSalary}
                  monthCheckInCount={monthCheckInCount}
                />
                <section className="hallmark-panel px-4 py-4 sm:px-6 sm:py-5">
                  <p className="hallmark-eyebrow">Main flow</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        setIsWorkspacePanelOpen(false);
                        openCheckInModal(new Date());
                      }}
                      className="rounded-[1.6rem] border border-natural-border bg-white px-4 py-4 text-left shadow-sm hover:-translate-y-0.5 hover:border-natural-accent"
                    >
                      <p className="text-sm font-semibold text-natural-heading">Check-in ngay</p>
                      <p className="mt-1 text-sm text-natural-muted">
                        Mo phieu diem danh va chon lop.
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setIsWorkspacePanelOpen(false);
                        setIsManageClassesOpen(true);
                      }}
                      className="rounded-[1.6rem] border border-natural-border bg-white px-4 py-4 text-left shadow-sm hover:-translate-y-0.5 hover:border-natural-accent"
                    >
                      <p className="text-sm font-semibold text-natural-heading">Cap nhat lop</p>
                      <p className="mt-1 text-sm text-natural-muted">
                        Sua luong, thoi luong va ghi chu.
                      </p>
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        setIsWorkspacePanelOpen(false);
                        handleExportData();
                      }}
                      className="hallmark-button-secondary"
                    >
                      <Download className="h-4 w-4" /> Xuat du lieu
                    </button>
                    <button
                      onClick={() => {
                        setIsWorkspacePanelOpen(false);
                        setIsManageClassesOpen(true);
                      }}
                      className="hallmark-button-secondary"
                    >
                      <Pencil className="h-4 w-4" /> Danh sach lop
                    </button>
                    <button
                      onClick={() => {
                        setIsWorkspacePanelOpen(false);
                        setIsBulkImportOpen(true);
                      }}
                      className="hallmark-button-primary"
                    >
                      <Upload className="h-4 w-4" /> Nhap nhanh lich day
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => openCheckInModal(new Date())}
        className="group fixed bottom-6 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-natural-heading text-white shadow-[0_20px_44px_rgba(15,41,56,0.28)] sm:bottom-10 sm:right-10 sm:h-16 sm:w-16"
        id="add-checkin-fab"
      >
        <Plus className="h-7 w-7 sm:h-8 sm:w-8" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsWorkspacePanelOpen(true)}
        className="fixed bottom-6 left-5 z-20 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-natural-border bg-white/96 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-heading shadow-[0_16px_34px_rgba(15,41,56,0.14)] sm:hidden"
        id="workspace-drawer-btn"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Cong cu
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
                  <h3 className="text-xl font-serif text-natural-heading">
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
                    <p className="text-natural-text/30 font-serif text-lg">
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
                  <h3 className="text-xl font-serif text-natural-heading">
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
                  <h3 className="text-base font-serif text-natural-heading sm:text-xl">
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
                    <div className="rounded-[2rem] border border-natural-border bg-natural-surface px-6 py-10 text-center text-natural-text/35 font-serif">
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
                    <div className="flex h-full min-h-[220px] items-center justify-center text-center text-sm text-natural-text/35 font-serif sm:min-h-[280px]">
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
                  <h3 className="text-xl font-serif text-natural-heading">
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
              className="relative w-full max-w-5xl overflow-y-auto rounded-t-[2.25rem] border-t border-natural-border bg-white px-3 py-4 shadow-2xl sm:max-h-[95vh] sm:rounded-[3rem] sm:px-8 sm:py-8 lg:px-10"
              id="checkin-modal"
            >
              <div className="mb-4 flex items-start justify-between gap-3 sm:mb-8 sm:gap-4">
                <div className="max-w-xl">
                  <p className="hallmark-eyebrow">Check-in flow</p>
                  <h2 className="mt-2 font-serif text-2xl text-natural-heading sm:mt-3 sm:text-4xl">
                    Check-in lop hoc
                  </h2>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-natural-text/42 sm:mt-2 sm:text-xs sm:tracking-[0.22em]">
                    {format(selectedDay, 'eeee, dd MMMM', { locale: vi })}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-natural-muted sm:mt-3 sm:text-sm sm:leading-6">
                    Chon gio, chon lop, roi xac nhan trong cung mot khung de thao tac nhanh hon.
                  </p>
                </div>
                <button
                  onClick={closeCheckInModal}
                  className="rounded-full px-2.5 py-2 text-sm font-bold text-natural-warning hover:bg-natural-warning/5 sm:p-3"
                >
                  Dong
                </button>
              </div>

              <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-[0.94fr_1.06fr]">
                <div className="space-y-3.5 sm:space-y-5">
                  <section className="rounded-[1.5rem] border border-natural-border bg-natural-panel px-4 py-4 shadow-sm sm:rounded-[2rem] sm:px-5 sm:py-5">
                    <div className="grid gap-3 sm:gap-4">
                      <div className="rounded-[1.25rem] border border-natural-border-light bg-white/70 px-3.5 py-3 sm:px-4 sm:py-4">
                        <label className="hallmark-eyebrow block pb-2 sm:pb-2.5">Bat dau luc</label>
                        <input
                          type="time"
                          value={checkInStartTime}
                          onChange={(event) => setCheckInStartTime(event.target.value)}
                          className="hallmark-input min-h-0 border-natural-border-light bg-white px-3.5 py-2.5 text-sm sm:px-4 sm:py-3 sm:text-base"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsClassListOpen((currentValue) => !currentValue)}
                        className="w-full rounded-[1.25rem] border border-natural-border-light bg-white/70 px-3.5 py-3 text-left sm:px-4 sm:py-4"
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div>
                            <p className="hallmark-eyebrow">Lop da chon</p>
                            <p className="mt-1.5 text-lg font-semibold text-natural-heading sm:mt-2 sm:text-xl">
                              {selectedClass ? selectedClass.name : 'Chua chon lop'}
                            </p>
                            <p className="mt-1.5 text-xs leading-5 text-natural-muted sm:mt-2 sm:text-sm">
                              {selectedClass
                                ? `${selectedClass.durationHours} gio • ${formatCurrency(selectedClass.salary)}/gio`
                                : 'Chon trong danh sach ben canh hoac tao lop moi ngay tai day.'}
                            </p>
                          </div>
                          <span className="rounded-full border border-natural-border bg-white px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-natural-text/65 sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.18em]">
                            {isClassListOpen ? 'Thu gon' : selectedClass ? 'Doi lop' : 'Chon lop'}
                          </span>
                        </div>

                        {selectedClass?.note ? (
                          <p className="mt-3 rounded-[1rem] border border-natural-border-light bg-white/90 px-3 py-2 text-xs leading-5 text-natural-muted sm:mt-4 sm:rounded-[1.25rem] sm:px-3.5 sm:py-2.5 sm:text-sm">
                            {selectedClass.note}
                          </p>
                        ) : null}
                      </button>
                    </div>
                  </section>

                  {selectedClass ? (
                    <section className="rounded-[1.5rem] border border-natural-border bg-natural-surface px-4 py-4 sm:rounded-[2rem] sm:px-5 sm:py-5">
                      <p className="hallmark-eyebrow">Buoi hoc se tao</p>
                      <p className="mt-2 text-xl font-semibold text-natural-heading sm:mt-3 sm:text-2xl">
                        {selectedTimePreview?.timeRange ?? 'Khong doc duoc gio'}
                      </p>
                      <p className="mt-1.5 text-xs leading-5 text-natural-muted sm:mt-2 sm:text-sm">
                        {selectedClass.durationHours} gio x {formatCurrency(selectedClass.salary)}/gio ={' '}
                        <span className="font-semibold text-natural-accent">
                          {formatCurrency(selectedClass.durationHours * selectedClass.salary)}
                        </span>
                      </p>
                    </section>
                  ) : null}

                  <button
                    onClick={handleConfirmCheckIn}
                    disabled={!selectedClassId || !selectedTimePreview}
                    className={`
                      w-full rounded-[1.4rem] py-4 text-base font-bold tracking-tight transition-all sm:rounded-[1.75rem] sm:py-5 sm:text-lg
                      ${!selectedClassId || !selectedTimePreview
                        ? 'cursor-not-allowed bg-natural-surface text-natural-text/18'
                        : 'bg-natural-accent text-white shadow-[0_20px_42px_rgba(214,176,107,0.28)] hover:bg-natural-heading active:scale-[0.98]'
                      }
                    `}
                  >
                    Xac nhan check-in
                  </button>
                </div>

              </div>

              <AnimatePresence>
                {isClassListOpen ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2.25rem] p-2 sm:rounded-[3rem] sm:p-6">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsClassListOpen(false)}
                      className="absolute inset-0 rounded-[2.25rem] bg-natural-heading/18 backdrop-blur-[2px] sm:rounded-[3rem]"
                    />
                    <motion.div
                      initial={{ scale: 0.96, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.96, opacity: 0, y: 10 }}
                      className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[1.6rem] border border-natural-border bg-white p-4 shadow-[0_30px_80px_rgba(15,41,56,0.18)] sm:rounded-[2rem] sm:p-6"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                        <div>
                          <p className="hallmark-eyebrow">Danh sach lop</p>
                          <p className="mt-2 text-lg font-semibold text-natural-heading sm:text-xl">
                            Chon lop ngay tai day
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-natural-muted sm:mt-2 sm:text-sm">
                            Chon mot lop de check-in, hoac tao lop moi ngay trong popup nay.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsAddingClass(true)}
                            className="rounded-full border border-natural-border bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-natural-heading hover:border-natural-accent sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.18em]"
                          >
                            Them lop
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsClassListOpen(false)}
                            className="rounded-full p-2 text-natural-text/30 transition-colors hover:text-natural-warning"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid max-h-[280px] gap-2.5 overflow-y-auto pr-1 no-scrollbar sm:max-h-[420px] sm:gap-3 sm:grid-cols-2">
                        {sortedClasses.map((classItem) => {
                          const isActive = classItem.id === selectedClassId;

                          return (
                            <button
                              key={classItem.id}
                              onClick={() => {
                                setSelectedClassId(classItem.id);
                                setIsClassListOpen(false);
                              }}
                              className={`
                                rounded-[1.2rem] border p-3 text-left transition-all sm:rounded-[1.5rem] sm:p-4
                                ${isActive
                                  ? 'border-natural-accent bg-white shadow-[0_16px_30px_rgba(214,176,107,0.16)]'
                                  : 'border-natural-border bg-natural-surface hover:-translate-y-0.5 hover:border-natural-heading'
                                }
                              `}
                            >
                              <div className="flex items-start justify-between gap-3 sm:gap-4">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-natural-heading sm:text-base">
                                    {classItem.name}
                                  </p>
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-natural-text/40 sm:text-[10px] sm:tracking-[0.2em]">
                                    {classItem.durationHours} gio moi buoi
                                  </p>
                                  {classItem.note ? (
                                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-natural-muted sm:mt-3 sm:text-sm">
                                      {classItem.note}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-semibold text-natural-accent sm:text-base">
                                    {formatCurrency(classItem.salary)}/gio
                                  </p>
                                  {isActive ? (
                                    <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-natural-accent sm:mt-2 sm:text-[10px] sm:tracking-[0.2em]">
                                      Dang chon
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {!sortedClasses.length ? (
                          <div className="rounded-[1.25rem] border border-dashed border-natural-border bg-white/75 px-4 py-6 text-center text-xs leading-5 text-natural-text/45 sm:col-span-2 sm:rounded-[1.5rem] sm:px-5 sm:py-8 sm:text-sm">
                            Chua co lop nao. Bam "Them lop" de tao lop dau tien.
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  </div>
                ) : null}

                {isAddingClass ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2.25rem] p-2 sm:rounded-[3rem] sm:p-6">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={resetClassForm}
                      className="absolute inset-0 rounded-[2.25rem] bg-natural-heading/18 backdrop-blur-[2px] sm:rounded-[3rem]"
                    />
                    <motion.div
                      initial={{ scale: 0.96, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.96, opacity: 0, y: 10 }}
                      className="relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[1.6rem] border border-natural-border bg-white p-4 shadow-[0_30px_80px_rgba(15,41,56,0.18)] sm:rounded-[2rem] sm:p-6"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:gap-4">
                        <div>
                          <p className="hallmark-eyebrow">Quick add</p>
                          <p className="mt-2 text-lg font-semibold text-natural-heading sm:text-xl">
                            Tao lop moi ma khong roi khoi flow check-in
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-natural-muted sm:mt-2 sm:text-sm">
                            Luu xong, lop moi se duoc chon ngay de ban tiep tuc check-in.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetClassForm}
                          className="rounded-full p-2 text-natural-text/30 transition-colors hover:text-natural-warning"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <label className="hallmark-eyebrow block px-1 pb-2.5 sm:pb-3">Ten lop</label>
                          <input
                            type="text"
                            value={className}
                            onChange={(event) => setClassName(event.target.value)}
                            placeholder="Vi du: Ban An, lop speaking..."
                            className="hallmark-input px-4 py-3 text-sm placeholder:text-natural-text/24 sm:px-5 sm:py-4 sm:text-base"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="hallmark-eyebrow block px-1 pb-2.5 sm:pb-3">Luong moi gio</label>
                            <input
                              type="number"
                              value={classSalary}
                              onChange={(event) => setClassSalary(event.target.value)}
                              placeholder="0"
                              className="hallmark-input px-4 py-3 text-sm placeholder:text-natural-text/24 sm:px-5 sm:py-4 sm:text-base"
                            />
                          </div>
                          <div>
                            <label className="hallmark-eyebrow block px-1 pb-2.5 sm:pb-3">So gio hoc</label>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={classDurationHours}
                              onChange={(event) => setClassDurationHours(event.target.value)}
                              placeholder="Vi du: 1.5"
                              className="hallmark-input px-4 py-3 text-sm sm:px-5 sm:py-4 sm:text-base"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="hallmark-eyebrow block px-1 pb-2.5 sm:pb-3">Ghi chu</label>
                          <textarea
                            value={classNote}
                            onChange={(event) => setClassNote(event.target.value)}
                            placeholder="Them ghi chu cho lop hoc..."
                            rows={3}
                            className="hallmark-input resize-none px-4 py-3 text-sm placeholder:text-natural-text/24 sm:px-5 sm:py-4 sm:text-base"
                          />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={handleSaveClass}
                            className="hallmark-button-primary flex-1 rounded-[1.25rem] py-3.5 text-[10px] sm:rounded-[1.5rem] sm:py-4 sm:text-[11px]"
                          >
                            <Check className="h-5 w-5" /> Luu lop
                          </button>
                          <button
                            onClick={resetClassForm}
                            className="hallmark-button-secondary rounded-[1.25rem] py-3.5 text-[10px] sm:rounded-[1.5rem] sm:py-4 sm:text-[11px]"
                          >
                            Huy
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

    </div>
  );
}
