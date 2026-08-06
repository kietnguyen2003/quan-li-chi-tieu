import React, { useEffect, useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types';
import { loadStoredValue } from '../utils';
import { AttendanceContext } from './attendanceContextShared';

const STORAGE_KEY_REGULAR_CHECK_INS = 'class_checkin_records';
const STORAGE_KEY_REGULAR_CLASSES = 'class_checkin_classes';
const STORAGE_KEY_SALARY_PAYMENTS = 'class_checkin_salary_payments';

const normalizeLoadedClasses = (storedClasses: TeachingClass[]): TeachingClass[] => {
  return storedClasses.map((classItem) => {
    const inferredDuration =
      typeof classItem.durationHours === 'number' && Number.isFinite(classItem.durationHours)
        ? classItem.durationHours
        : 1;

    return {
      id: classItem.id,
      name: classItem.name,
      salary: Number(classItem.salary) || 0,
      note: classItem.note ?? '',
      durationHours: inferredDuration,
    };
  });
};

const normalizeLoadedCheckIns = (storedCheckIns: ClassCheckIn[]): ClassCheckIn[] => {
  return storedCheckIns.map((checkIn) => ({
    ...checkIn,
    sessionHours:
      typeof checkIn.sessionHours === 'number' && Number.isFinite(checkIn.sessionHours)
        ? checkIn.sessionHours
        : undefined,
    sessionAmount:
      typeof checkIn.sessionAmount === 'number' && Number.isFinite(checkIn.sessionAmount)
        ? checkIn.sessionAmount
        : undefined,
  }));
};

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const [checkIns, setCheckIns] = useState<ClassCheckIn[]>(() =>
    normalizeLoadedCheckIns(loadStoredValue<ClassCheckIn[]>(STORAGE_KEY_REGULAR_CHECK_INS, [])),
  );

  const [classes, setClasses] = useState<TeachingClass[]>(() =>
    normalizeLoadedClasses(loadStoredValue<TeachingClass[]>(STORAGE_KEY_REGULAR_CLASSES, [])),
  );

  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>(() =>
    loadStoredValue<SalaryPayment[]>(STORAGE_KEY_SALARY_PAYMENTS, []),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CHECK_INS, JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REGULAR_CLASSES, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SALARY_PAYMENTS, JSON.stringify(salaryPayments));
  }, [salaryPayments]);

  const nextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
  const prevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));

  const addCheckIn = (checkIn: Omit<ClassCheckIn, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setCheckIns((prev) => [...prev, { ...checkIn, id }]);
  };

  const deleteCheckIn = (id: string) => {
    setCheckIns((prev) => prev.filter((item) => item.id !== id));
  };

  const addClass = (newClassData: Omit<TeachingClass, 'id'>): TeachingClass => {
    const id = Date.now().toString();
    const createdClass: TeachingClass = { ...newClassData, id };
    setClasses((prev) => [...prev, createdClass]);
    return createdClass;
  };

  const updateClass = (updatedClass: TeachingClass) => {
    setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const addSalaryPayment = (payment: Omit<SalaryPayment, 'id'>) => {
    const id = Date.now().toString();
    setSalaryPayments((prev) => [...prev, { ...payment, id }]);
  };

  const deleteSalaryPayment = (id: string) => {
    setSalaryPayments((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <AttendanceContext.Provider
      value={{
        currentDate,
        setCurrentDate,
        nextMonth,
        prevMonth,
        checkIns,
        setCheckIns,
        classes,
        setClasses,
        salaryPayments,
        setSalaryPayments,
        addCheckIn,
        deleteCheckIn,
        addClass,
        updateClass,
        deleteClass,
        addSalaryPayment,
        deleteSalaryPayment,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};
