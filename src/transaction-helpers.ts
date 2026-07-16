import { format, isSameMonth, parseISO } from 'date-fns';
import type { ClassCheckIn, TeachingClass } from './types.ts';

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
    if (checkIn.sessionAmount > 0) {
      return checkIn.sessionAmount;
    }

    if ((classItem?.salary ?? 0) === 0) {
      return checkIn.sessionAmount;
    }
  }

  return computedAmount;
};
