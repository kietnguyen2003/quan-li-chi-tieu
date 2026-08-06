import { useContext } from 'react';
import { AttendanceContext } from './attendanceContextShared';
import type { AttendanceContextType } from './attendanceContextShared';

export const useAttendance = (): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};
