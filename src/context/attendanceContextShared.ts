import { createContext } from 'react';
import type React from 'react';
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types';

export interface AttendanceContextType {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  nextMonth: () => void;
  prevMonth: () => void;
  checkIns: ClassCheckIn[];
  setCheckIns: React.Dispatch<React.SetStateAction<ClassCheckIn[]>>;
  classes: TeachingClass[];
  setClasses: React.Dispatch<React.SetStateAction<TeachingClass[]>>;
  salaryPayments: SalaryPayment[];
  setSalaryPayments: React.Dispatch<React.SetStateAction<SalaryPayment[]>>;
  addCheckIn: (checkIn: Omit<ClassCheckIn, 'id'>) => void;
  deleteCheckIn: (id: string) => void;
  addClass: (newClass: Omit<TeachingClass, 'id'>) => TeachingClass;
  updateClass: (updatedClass: TeachingClass) => void;
  deleteClass: (id: string) => void;
  addSalaryPayment: (payment: Omit<SalaryPayment, 'id'>) => void;
  deleteSalaryPayment: (id: string) => void;
}

export const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);
