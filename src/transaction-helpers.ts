import { format, isSameMonth, parseISO } from 'date-fns';
import type { ClassCheckIn, TeachingClass } from './types.ts';

// Billing hours are separate from actual training duration and saved history.
export const getBillableHours = (className: string, actualHours: number): number =>
  className.trim().toLowerCase() === 'hamza' ? Math.floor(actualHours) : Math.ceil(actualHours);

export const calculateSessionAmount = (
  classItem: Pick<TeachingClass, 'name' | 'salary'>,
  actualHours: number,
): number => classItem.salary * getBillableHours(classItem.name, actualHours);

export const groupCheckInsByDate = (
  checkIns: ClassCheckIn[],
): Record<string, ClassCheckIn[]> => {
  const groups: Record<string, ClassCheckIn[]> = {};

  checkIns.forEach((checkIn) => {
    const dateKey = format(parseISO(checkIn.date), 'yyyy-MM-dd');

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(checkIn);
  });

  return groups;
};

export const getMonthTotalSalary = (
  checkIns: ClassCheckIn[],
  classes: TeachingClass[],
  currentDate: Date,
): number => {
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  return checkIns
    .filter((checkIn) => isSameMonth(parseISO(checkIn.date), currentDate))
    .reduce((total, checkIn) => {
      const classItem = classMap.get(checkIn.classId);
      const sessionAmount = resolveSessionAmount(checkIn, classItem);

      return total + sessionAmount;
    }, 0);
};

export const resolveSessionHours = (
  checkIn: ClassCheckIn,
  classItem?: TeachingClass,
): number => {
  return checkIn.sessionHours ?? classItem?.durationHours ?? 0;
};

export const resolveSessionAmount = (
  checkIn: ClassCheckIn,
  classItem?: TeachingClass,
): number => {
  const sessionHours = resolveSessionHours(checkIn, classItem);
  const computedAmount = (classItem?.salary ?? 0) * sessionHours;

  if (typeof checkIn.sessionAmount === 'number' && Number.isFinite(checkIn.sessionAmount)) {
    return checkIn.sessionAmount;
  }

  return computedAmount;
};
