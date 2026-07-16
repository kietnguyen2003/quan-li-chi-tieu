/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TeachingClass {
  id: string;
  name: string;
  salary: number;
  note: string;
  durationHours: number;
}

export interface FixedClassSchedule {
  id: string;
  name: string;
  salary: number;
  note: string;
  durationHours: number;
  startTime: string;
  weekdays: number[];
}

export interface ClassCheckIn {
  id: string;
  classId: string;
  date: string; // ISO string
  startTime?: string;
  endTime?: string;
  sessionHours?: number;
  sessionAmount?: number;
  timeRange?: string;
}
