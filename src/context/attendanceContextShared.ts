import { createContext } from 'react';
import type React from 'react';
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types';

export interface AttendanceContextType {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  nextMonth: () => void;
  prevMonth: () => void;
  checkIns: ClassCheckIn[];
  classes: TeachingClass[];
  salaryPayments: SalaryPayment[];
  loading: boolean;
  hasLoaded: boolean;
  saving: boolean;
  loadError: string | null;
  dataError: string | null;
  isCloud: boolean;
  reload: () => Promise<void>;
  clearDataError: () => void;
  clearLocalData: () => void;
  addCheckIn: (checkIn: Omit<ClassCheckIn, 'id'>) => Promise<void>;
  deleteCheckIn: (id: string) => Promise<void>;
  addClass: (newClass: Omit<TeachingClass, 'id'>) => Promise<TeachingClass>;
  updateClass: (updatedClass: TeachingClass) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addSalaryPayment: (payment: Omit<SalaryPayment, 'id'>) => Promise<void>;
  deleteSalaryPayment: (id: string) => Promise<void>;
  importSchedule: (classes: TeachingClass[], checkIns: ClassCheckIn[]) => Promise<void>;
}

export const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);
